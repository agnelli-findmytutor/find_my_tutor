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

    // 1. RECUPERA UTENTE
    const { data: { user } } = await sbClient.auth.getUser();

    if (user) {
        console.log("Utente loggato:", user.email);
        
        let userRole = 'studente';
        try {
            const { data: profile } = await sbClient.from('profiles').select('role').eq('id', user.id).single();
            if (profile && profile.role) userRole = profile.role;
        } catch (e) { /* fallback */ }

        const avatarUrl = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';

        // --- A. GESTIONE HEADER ---
        const loginBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn');

        if (loginBtn) {
            let dashboardLink = "dashboard.html"; 
            let badgeHtml = `<span class="badge-student">Studente</span>`;
            
            if (userRole === 'tutor') {
                badgeHtml = `<span class="badge-tutor">Studente Tutor</span>`;
            } else if (userRole === 'admin') {
                badgeHtml = `<span class="badge-admin" style="background:#f3e5f5; color:#4a148c; border:1px solid #e1bee7; padding:4px 8px; border-radius:10px; font-weight:bold; font-size:0.7rem;">ADMIN</span>`;
            }

            loginBtn.outerHTML = `
                <div class="user-profile-header">
                    ${badgeHtml}
                    <a href="${dashboardLink}" class="profile-link">
                        <img src="${avatarUrl}" alt="Profilo" class="profile-pic-header">
                    </a>
                </div>
            `;
        }

        // --- B. GESTIONE MENU ---
        const navLinks = document.querySelector('.nav-links');

        if (navLinks) {
            
            // 1. Link "Prenota Lezione" (CORRETTO: Rimosso style inline)
            if (!document.querySelector('.link-prenota')) {
                const liPrenota = document.createElement('li');
                // Ho tolto style="..." così eredita lo stile standard del CSS
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
    }
});