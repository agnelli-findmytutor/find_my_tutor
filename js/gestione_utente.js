document.addEventListener('DOMContentLoaded', async () => {

    // CONFIGURAZIONE SUPABASE
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

    if (typeof supabase === 'undefined') {
        console.error("Supabase non trovato! Assicurati di aver incluso lo script nel <head>.");
        return;
    }

    const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // FUNZIONE HELPER: Controlla se il link corrisponde alla pagina attuale
    // Se sì, aggiunge la classe 'active'
    const checkActive = (linkHtmlString) => {
        const hrefMatch = linkHtmlString.match(/href="([^"]*)"/);
        const href = hrefMatch ? hrefMatch[1] : '';
        const currentPage = window.location.pathname.split("/").pop();

        if (href === currentPage) {
            return linkHtmlString.replace('class="', 'class="active ');
        }
        if (href === currentPage && !linkHtmlString.includes('class=')) {
            return linkHtmlString.replace('<a ', '<a class="active" ');
        }
        return linkHtmlString;
    };

    // FUNZIONE UI: Aggiorna Header e Menu (Riutilizzabile)
    const updateInterface = (userRole, avatarUrl) => {
        
        // --- A. GESTIONE HEADER (Profilo vs Accedi) ---
        // Cerchiamo il bottone login O il profilo già esistente (se la funzione viene richiamata)
        const loginBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn');
        const existingProfile = document.querySelector('.user-profile-header');

        // Definiamo il badge in base al ruolo
        let badgeHtml = `<span class="badge-student">Studente</span>`;
        if (userRole === 'tutor') {
            badgeHtml = `<span class="badge-tutor">Studente Tutor</span>`;
        } else if (userRole === 'admin') {
            badgeHtml = `<span class="badge-admin" style="background:#f3e5f5; color:#4a148c; border:1px solid #e1bee7; padding:4px 8px; border-radius:10px; font-weight:bold; font-size:0.7rem;">ADMIN</span>`;
        }

        // Se c'è ancora il bottone "Accedi", lo sostituiamo con il profilo
        if (loginBtn && !existingProfile) {
            loginBtn.outerHTML = `
                <div class="user-profile-header">
                    ${badgeHtml}
                    <a href="dashboard.html" class="profile-link">
                        <img src="${avatarUrl}" alt="Profilo" class="profile-pic-header">
                    </a>
                </div>
            `;
        } 
        // Se il profilo esiste già (es. aggiornamento da cache a rete), aggiorniamo solo i dati se necessario
        else if (existingProfile) {
            const currentBadge = existingProfile.querySelector('span');
            if(currentBadge) currentBadge.outerHTML = badgeHtml;
            const currentImg = existingProfile.querySelector('img');
            if(currentImg) currentImg.src = avatarUrl;
        }

        // --- B. GESTIONE MENU ---
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            // 1. Link "Prenota Lezione" (CORRETTO: Rimosso style inline)
            if (!document.querySelector('.link-prenota')) {
                const liPrenota = document.createElement('li');
                let linkHTML = '<a href="prenota.html" class="link-prenota">Agenda Studente</a>';
                liPrenota.innerHTML = checkActive(linkHTML);
                
                const refElement = navLinks.children[2]; 
                navLinks.insertBefore(liPrenota, refElement || null);
            }
            
            // 2. Link "Agenda Tutor"
            if ((userRole === 'tutor' || userRole === 'admin') && !document.querySelector('.link-agenda')) {
                const liAgenda = document.createElement('li');
                let linkHTML = '<a href="appuntamenti.html" class="link-agenda">Agenda Tutor</a>';
                liAgenda.innerHTML = checkActive(linkHTML);
                
                const prenotaLink = document.querySelector('.link-prenota').parentElement;
                if (prenotaLink && prenotaLink.nextSibling) {
                    navLinks.insertBefore(liAgenda, prenotaLink.nextSibling);
                } else {
                    navLinks.appendChild(liAgenda);
                }
            }

            // 3. Link "Pannello Admin"
            if (userRole === 'admin' && !document.querySelector('.link-admin')) {
                const liAdmin = document.createElement('li');
                // Mantengo lo stile viola SOLO per l'admin per distinguerlo
                let linkHTML = '<a href="admin.html" class="link-admin" style="color: #4a148c; font-weight: 800;"><i class="fas fa-user-shield"></i> Pannello Admin</a>';
                liAdmin.innerHTML = checkActive(linkHTML);
                
                const homeLink = navLinks.children[0];
                if (homeLink && homeLink.nextSibling) {
                    navLinks.insertBefore(liAdmin, homeLink.nextSibling);
                } else {
                    navLinks.appendChild(liAdmin);
                }
            }
        }
    };

    // --- 1. CONTROLLO VELOCE (CACHE LOCALE) ---
    // Questo elimina il "flicker" mostrando l'interfaccia loggata immediatamente
    const cachedRole = localStorage.getItem('fmt_role');
    const cachedAvatar = localStorage.getItem('fmt_avatar');

    if (cachedRole) {
        updateInterface(cachedRole, cachedAvatar || 'https://via.placeholder.com/150');
    }

    // --- 2. CONTROLLO REALE (SUPABASE NETWORK) ---
    // Verifica che il token sia ancora valido e aggiorna i dati se cambiati
    const { data: { user } } = await sbClient.auth.getUser();

    if (user) {
        console.log("Utente loggato (Network):", user.email);
        
        let userRole = 'studente';
        try {
            const { data: profile } = await sbClient.from('profiles').select('role').eq('id', user.id).single();
            if (profile && profile.role) userRole = profile.role;
        } catch (e) { /* fallback */ }

        const avatarUrl = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';

        // Aggiorniamo la cache per la prossima volta
        localStorage.setItem('fmt_role', userRole);
        localStorage.setItem('fmt_avatar', avatarUrl);

        // Aggiorniamo l'interfaccia (nel caso la cache fosse vecchia o vuota)
        updateInterface(userRole, avatarUrl);

        // --- AUTO-FILL EMAIL (Solo su diventa_tutor.html) ---
        if (window.location.pathname.includes('diventa_tutor.html')) {
            // Cerca l'input email (per ID 'email' o genericamente per tipo)
            const emailInput = document.getElementById('email') || document.querySelector('input[type="email"]');
            if (emailInput) {
                emailInput.value = user.email;
                emailInput.readOnly = true; // Rende il campo non modificabile
                emailInput.style.backgroundColor = "#e9ecef"; // Sfondo grigio per indicare che è bloccato
                emailInput.style.cursor = "not-allowed";
            }
        }

    } else {
        // Se Supabase dice che non siamo loggati, ma avevamo mostrato l'interfaccia (cache), dobbiamo pulire
        if (cachedRole) {
            localStorage.removeItem('fmt_role');
            localStorage.removeItem('fmt_avatar');
            window.location.reload(); // Ricarica per mostrare lo stato pulito "Accedi"
        }
    }
});