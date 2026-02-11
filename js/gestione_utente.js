(function() {
    // PROTEZIONE CONSOLE: Impedisce la visualizzazione di log residui
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.log("%cAccesso Protetto", "color: red; font-size: 20px; font-weight: bold;");
        console.log("Il monitoraggio della console è disabilitato per motivi di sicurezza.");
    }

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
        let userRole = 'studente';

        // Controlliamo se il profilo esiste già
        let { data: profile, error: profileError } = await sbClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        // SINCRONIZZAZIONE RUOLO: Se il ruolo nel DB è diverso da quello in cache (o se la cache è vuota)
        // Questo rileva se hai cambiato il ruolo manualmente da Supabase o dal pannello Admin
        if (profile && profile.role !== cachedRole) {
            localStorage.setItem('fmt_role', profile.role);
            localStorage.setItem('fmt_avatar', user.user_metadata.avatar_url || 'https://via.placeholder.com/150');
            
            // Forza il ricaricamento per attivare i nuovi permessi e mostrare i menu corretti
            window.location.reload();
            return; // Interrompiamo l'esecuzione per attendere il ricaricamento
        }

        // Se il profilo non esiste, lo creiamo automaticamente
        if (!profile && !profileError) {
            const { data: newProfile, error: insertError } = await sbClient
                .from('profiles')
                .insert([{ 
                    id: user.id, 
                    email: user.email, 
                    full_name: user.user_metadata.full_name || "",
                    role: 'studente' 
                }])
                .select()
                .single();
            
            if (!insertError) profile = newProfile;
        }

        if (profile && profile.role) userRole = profile.role;

        const avatarUrl = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';

        // Aggiorniamo la cache per la prossima volta
        localStorage.setItem('fmt_role', userRole);
        localStorage.setItem('fmt_avatar', avatarUrl);

        // Aggiorniamo l'interfaccia (nel caso la cache fosse vecchia o vuota)
        updateInterface(userRole, avatarUrl);

        // --- AUTO-FILL IDENTITY (Solo su diventa_tutor.html) ---
        if (window.location.pathname.includes('diventa_tutor.html')) {
            const emailInput = document.getElementById('email');
            if (emailInput) {
                emailInput.value = user.email;
                emailInput.readOnly = true;
                emailInput.style.backgroundColor = "#e9ecef";
                emailInput.style.cursor = "not-allowed";
            }

            const nameInput = document.getElementById('fullName');
            if (nameInput) {
                nameInput.value = user.user_metadata.full_name || "";
                nameInput.readOnly = true;
                nameInput.style.backgroundColor = "#e9ecef";
                nameInput.style.cursor = "not-allowed";
            }
        }

        // --- CONTROLLO BAN (Notifica Popup) ---
        try {
            const { data: banLog, error: banError } = await sbClient
                .from('banned_tutors_log')
                .select('*')
                .eq('user_id', user.id)
                .eq('seen', false)
                .maybeSingle();
            
            if (banError) console.error("Errore lettura ban:", banError);

            if (banLog) {
                const modal = document.createElement('div');
                modal.className = 'modal-overlay'; // Visibile di default (senza 'hidden')
                // Forziamo lo stile per essere sicuri che appaia sopra tutto
                modal.style.cssText = "z-index: 100000; opacity: 1; visibility: visible; display: flex;";
                modal.innerHTML = `
                    <div class="modal-card">
                        <div class="modal-icon warning" style="background:#FFEBEE; color:#c62828;"><i class="fas fa-user-slash"></i></div>
                        <h3 style="color:#c62828;">Ruolo Revocato</h3>
                        <p>Il tuo ruolo di Tutor è stato rimosso dall'amministrazione.</p>
                        <div style="background:#f9f9f9; padding:15px; border-left:4px solid #c62828; border-radius:4px; color:#333; margin-bottom:20px; font-size:0.9rem; text-align:left;">
                            <strong>Motivo:</strong><br> ${banLog.reason}
                        </div>
                        <button class="btn-modal primary" id="ackBanBtn" style="width:100%;">Ho capito, torna a Studente</button>
                    </div>
                `;
                document.body.appendChild(modal);
                
                document.getElementById('ackBanBtn').onclick = async () => {
                    const { error: updateErr } = await sbClient
                        .from('banned_tutors_log')
                        .update({ seen: true })
                        .eq('id', banLog.id);
                    
                    if(updateErr) console.error("Errore aggiornamento ban:", updateErr);
                    modal.remove();
                    window.location.reload(); // Ricarica per aggiornare l'interfaccia a Studente
                };
            }
        } catch (e) { console.error("Err ban check", e); }

    } else {
        // Se Supabase dice che non siamo loggati, ma avevamo mostrato l'interfaccia (cache), dobbiamo pulire
        if (cachedRole) {
            localStorage.removeItem('fmt_role');
            localStorage.removeItem('fmt_avatar');
            window.location.reload(); // Ricarica per mostrare lo stato pulito "Accedi"
        }
    }
});
})();