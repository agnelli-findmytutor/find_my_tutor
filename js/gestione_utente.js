(function() {
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
    if (userRole === 'tutor' || userRole === 'staff' || userRole === 'admin') {
        document.querySelectorAll('a[href="diventa_tutor.html"]').forEach(el => el.style.display = 'none');
    }
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

                        if ((userRole === 'staff' || userRole === 'admin') && !document.querySelector('.link-staff')) {
                const liStaff = document.createElement('li');
                let linkHTML = '<a href="staff.html" class="link-staff"><i class="fas fa-user-tie"></i> Area Staff</a>';
                liStaff.innerHTML = checkActive(linkHTML);
                navLinks.appendChild(liStaff);
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

    // --- 1. CONTROLLO SESSIONE MASTERCOM & UNIFICAZIONE ACCOUNT ---
    const isMastercom = localStorage.getItem('fmt_auth_provider') === 'mastercom' || !!localStorage.getItem('fmt_token');
    if (isMastercom) {
        let fmtUser = (typeof FMT_API !== 'undefined') ? FMT_API.getCurrentUser() : null;
        if (!fmtUser) {
            try {
                fmtUser = JSON.parse(localStorage.getItem('fmt_user') || 'null');
            } catch (e) {}
        }

        if (fmtUser) {
            // Controlla se il browser ha anche una sessione Google attiva per lo stesso studente
            try {
                const { data: { user: sbUser } } = await sbClient.auth.getUser();
                if (sbUser) {
                    const sbFullName = sbUser.user_metadata?.full_name || '';
                    const match = (typeof FMT_API !== 'undefined' && FMT_API.namesOrEmailMatch)
                        ? FMT_API.namesOrEmailMatch(fmtUser.full_name, sbFullName, sbUser.email)
                        : true;

                    if (match) {
                        // UNIFICAZIONE IMMEDIATA DEI PROFILI
                        let { data: sbProfile } = await sbClient
                            .from('profiles')
                            .select('*')
                            .eq('id', sbUser.id)
                            .maybeSingle();

                        const unifiedRole = (sbProfile?.role === 'admin' || fmtUser.role === 'admin')
                            ? 'admin'
                            : ((sbProfile?.role === 'tutor' || fmtUser.role === 'tutor') ? 'tutor' : 'studente');

                        fmtUser.id = sbUser.id;
                        fmtUser.google_id = sbUser.id;
                        fmtUser.email = sbUser.email;
                        fmtUser.google_email = sbUser.email;
                        fmtUser.role = unifiedRole;
                        fmtUser.auth_provider = 'unified';
                        fmtUser.linked = true;

                        if (typeof FMT_API !== 'undefined' && FMT_API.setCurrentUser) {
                            FMT_API.setCurrentUser(fmtUser);
                            // Sincronizza anche con il database backend Flask
                            FMT_API.syncGoogleAccount({
                                id: sbUser.id,
                                email: sbUser.email,
                                full_name: fmtUser.full_name,
                                role: unifiedRole,
                                avatar_url: fmtUser.avatar_url
                            });
                        }
                    }
                }
            } catch (mergeErr) {
                console.warn("Verifica unificazione Google/Mastercom:", mergeErr);
            }

            // Render immediato da cache per evitare layout shift
            const cachedRole = fmtUser.role || localStorage.getItem('fmt_role') || 'studente';
            const cachedAvatar = fmtUser.avatar_url || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';
            updateInterface(cachedRole, cachedAvatar);

            // Auto-fill identity se su diventa_tutor.html
            if (window.location.pathname.includes('diventa_tutor.html')) {
                const emailInput = document.getElementById('email');
                if (emailInput) {
                    emailInput.value = fmtUser.email || '';
                    emailInput.readOnly = true;
                    emailInput.style.backgroundColor = "#e9ecef";
                    emailInput.style.cursor = "not-allowed";
                }

                const nameInput = document.getElementById('fullName');
                if (nameInput) {
                    nameInput.value = fmtUser.full_name || '';
                    nameInput.readOnly = true;
                    nameInput.style.backgroundColor = "#e9ecef";
                    nameInput.style.cursor = "not-allowed";
                }
            }

            // CONTROLLO ASINCRONO CRITTOGRAFICO CON IL SERVER (Previene manomissioni devtools)
            if (typeof FMT_API !== 'undefined' && FMT_API.getMe) {
                FMT_API.getMe().then(serverUser => {
                    if (serverUser) {
                        const verifiedRole = serverUser.role || 'studente';
                        const verifiedAvatar = serverUser.avatar_url || cachedAvatar;
                        if (verifiedRole !== cachedRole) {
                            updateInterface(verifiedRole, verifiedAvatar);
                        }
                    } else if (localStorage.getItem('fmt_token')) {
                        console.warn("Sessione token invalidata dal server.");
                        FMT_API.clearSession();
                        window.location.href = 'login.html';
                    }
                }).catch(err => {
                    console.warn("Verifica sessione in background:", err);
                });
            }

            return; // Utente Mastercom valido (e sincronizzato)
        }
    }

    // --- 2. CONTROLLO VELOCE SUPABASE (CACHE LOCALE) ---
    // Questo elimina il "flicker" mostrando l'interfaccia loggata immediatamente
    const cachedRole = localStorage.getItem('fmt_role');
    const cachedAvatar = localStorage.getItem('fmt_avatar');

    if (cachedRole) {
        updateInterface(cachedRole, cachedAvatar || 'https://via.placeholder.com/150');
    }

    // --- 3. CONTROLLO REALE (SUPABASE NETWORK) ---
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

        // DEBUG: Vediamo cosa legge il sito dal database
        if (profile) console.log("Ruolo letto da DB:", profile.role);

        // SINCRONIZZAZIONE RUOLO: Aggiorna se c'è discrepanza (senza ricaricare la pagina)
        if (profile && profile.role !== cachedRole) {
            localStorage.setItem('fmt_role', profile.role);
            localStorage.setItem('fmt_avatar', user.user_metadata.avatar_url || 'https://via.placeholder.com/150');
            updateInterface(profile.role, user.user_metadata.avatar_url || 'https://via.placeholder.com/150');
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

        const avatarUrl = user.user_metadata?.avatar_url || 'https://via.placeholder.com/150';
        const fullName = user.user_metadata?.full_name || profile?.full_name || (user.email ? user.email.split('@')[0] : 'Studente');

        // Sincronizza l'account Google con il backend Mastercom per unificare i dati se esiste
        let mergedUser = null;
        if (typeof FMT_API !== 'undefined' && FMT_API.syncGoogleAccount) {
            try {
                mergedUser = await FMT_API.syncGoogleAccount({
                    id: user.id,
                    email: user.email,
                    full_name: fullName,
                    role: userRole,
                    avatar_url: avatarUrl
                });
            } catch (syncErr) {
                console.warn("Sync Google con Flask backend:", syncErr);
            }
        }

        // Aggiorniamo la cache con il profilo completo (eventualmente arricchito dai dati Mastercom)
        const googleUserObj = mergedUser || {
            id: user.id,
            email: user.email,
            full_name: fullName,
            role: userRole,
            avatar_url: avatarUrl,
            auth_provider: 'google'
        };

        if (typeof FMT_API !== 'undefined' && FMT_API.setCurrentUser) {
            FMT_API.setCurrentUser(googleUserObj);
        } else {
            localStorage.setItem('fmt_user', JSON.stringify(googleUserObj));
            localStorage.setItem('fmt_role', userRole);
            localStorage.setItem('fmt_avatar', avatarUrl);
            localStorage.setItem('fmt_auth_provider', 'google');
        }

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
        // Se Supabase dice che non siamo loggati, ma avevamo mostrato l'interfaccia (cache), dobbiamo pulire senza ricaricare
        if (cachedRole && !isMastercom) {
            localStorage.removeItem('fmt_role');
            localStorage.removeItem('fmt_avatar');
            const existingProfile = document.querySelector('.user-profile-header');
            if (existingProfile) {
                existingProfile.outerHTML = `<a href="login.html" class="cta-btn" id="loginBtn">Accedi</a>`;
            }
        }
    }
});
})();



