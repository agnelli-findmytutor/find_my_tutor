(function() {
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

    let lastRenderedRole = null;
    let lastRenderedAvatar = null;

    // Costruisce e aggiorna l'Header in modo atomico, identico su tutte le pagine e senza layout shift
    const updateInterface = (userRole, avatarUrl) => {
        const safeRole = userRole || 'studente';
        const safeAvatar = avatarUrl || 'https://via.placeholder.com/150';

        // Evita re-render inutili del DOM se ruolo e avatar sono già applicati
        if (
            lastRenderedRole === safeRole &&
            lastRenderedAvatar === safeAvatar &&
            document.querySelector('.user-profile-header')
        ) {
            return;
        }
        lastRenderedRole = safeRole;
        lastRenderedAvatar = safeAvatar;

        // --- A. GESTIONE HEADER (Profilo vs Accedi) ---
        const loginBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn');
        const existingProfile = document.querySelector('.user-profile-header');

        let badgeHtml = `<span class="badge-student">Studente</span>`;
        if (safeRole === 'tutor') {
            badgeHtml = `<span class="badge-tutor">Studente Tutor</span>`;
        } else if (safeRole === 'staff') {
            badgeHtml = `<span class="badge-staff">Staff FSL</span>`;
        } else if (safeRole === 'admin') {
            badgeHtml = `<span class="badge-admin">Admin</span>`;
        }

        if (loginBtn && !existingProfile) {
            loginBtn.outerHTML = `
                <div class="user-profile-header">
                    ${badgeHtml}
                    <a href="dashboard.html" class="profile-link" title="Vai all'Area Personale">
                        <img src="${safeAvatar}" alt="Profilo" class="profile-pic-header">
                    </a>
                </div>
            `;
        } else if (existingProfile) {
            const currentBadge = existingProfile.querySelector('span');
            if (currentBadge) currentBadge.outerHTML = badgeHtml;
            const currentImg = existingProfile.querySelector('img');
            if (currentImg && currentImg.getAttribute('src') !== safeAvatar) {
                currentImg.src = safeAvatar;
            }
        }

        // --- B. GESTIONE MENU IDENTICA E DETERMINISTICA SU TUTTE LE PAGINE ---
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            let currentPage = window.location.pathname.split("/").pop() || 'index.html';
            if (!currentPage.includes('.html')) currentPage = 'index.html';

            const items = [
                { href: 'index.html', cls: 'link-home', icon: 'fas fa-home', label: 'Home' },
                { href: 'progetto.html', cls: 'link-progetto', icon: 'fas fa-project-diagram', label: 'Il nostro progetto' },
                { href: 'prenota.html', cls: 'link-prenota', icon: 'fas fa-calendar-check', label: 'Agenda Studente' }
            ];

            if (safeRole === 'tutor' || safeRole === 'admin') {
                items.push({ href: 'appuntamenti.html', cls: 'link-agenda', icon: 'fas fa-chalkboard-teacher', label: 'Agenda Tutor' });
            }
            if (safeRole === 'staff' || safeRole === 'admin') {
                items.push({ href: 'staff.html', cls: 'link-staff', icon: 'fas fa-user-tie', label: 'Area Staff' });
            }
            if (safeRole === 'admin') {
                items.push({ href: 'admin.html', cls: 'link-admin', icon: 'fas fa-user-shield', label: 'Pannello Admin' });
            }
            if (safeRole === 'studente') {
                items.push({ href: 'diventa_tutor.html', cls: 'link-diventa-tutor', icon: 'fas fa-user-graduate', label: 'Diventa Tutor' });
            }

            const mobileWrapper = navLinks.querySelector('.mobile-login-wrapper');
            navLinks.innerHTML = items.map(item => {
                const activeClass = (item.href === currentPage) ? ' active' : '';
                return `<li><a href="${item.href}" class="${item.cls}${activeClass}"><i class="${item.icon}"></i> ${item.label}</a></li>`;
            }).join('');

            if (mobileWrapper) {
                navLinks.appendChild(mobileWrapper);
            }
        }
    };

    // --- 0. IDRATAZIONE SINCRONA IMMEDIATA (ZERO LAG TRA LE PAGINE) ---
    const hydrateFromCacheImmediately = () => {
        try {
            let fmtUser = null;
            try {
                fmtUser = JSON.parse(localStorage.getItem('fmt_user') || 'null');
            } catch (e) {}

            const cachedRole = (fmtUser && fmtUser.role) || localStorage.getItem('fmt_role');
            const cachedAvatar = (fmtUser && fmtUser.avatar_url) || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';

            if (cachedRole) {
                updateInterface(cachedRole, cachedAvatar);
            }
        } catch (err) {
            console.warn("Cache header sync:", err);
        }
    };

    // Esegui subito (prima ancora di DOMContentLoaded) se l'header è già nel DOM
    hydrateFromCacheImmediately();

    document.addEventListener('DOMContentLoaded', async () => {
        // Assicura che l'header sia già aggiornato al frame 0
        hydrateFromCacheImmediately();

        if (typeof supabase === 'undefined') {
            return;
        }

        const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
                // 1A. Render sincrono immediato dalla sessione locale (nessuna attesa di rete!)
                const cachedRole = fmtUser.role || localStorage.getItem('fmt_role') || 'studente';
                const cachedAvatar = fmtUser.avatar_url || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';
                localStorage.setItem('fmt_role', cachedRole);
                localStorage.setItem('fmt_avatar', cachedAvatar);
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

                // 1B. Verifica unificazione Google/Mastercom in background (non blocca mai la UI)
                (async () => {
                    try {
                        const { data: { user: sbUser } } = await sbClient.auth.getUser();
                        if (sbUser) {
                            const sbFullName = sbUser.user_metadata?.full_name || '';
                            const match = (typeof FMT_API !== 'undefined' && FMT_API.namesOrEmailMatch)
                                ? FMT_API.namesOrEmailMatch(fmtUser.full_name, sbFullName, sbUser.email)
                                : true;

                            if (match) {
                                let { data: sbProfile } = await sbClient
                                    .from('profiles')
                                    .select('*')
                                    .eq('id', sbUser.id)
                                    .maybeSingle();

                                const unifiedRole = (sbProfile?.role === 'admin' || fmtUser.role === 'admin')
                                    ? 'admin'
                                    : ((sbProfile?.role === 'staff' || fmtUser.role === 'staff')
                                        ? 'staff'
                                        : ((sbProfile?.role === 'tutor' || fmtUser.role === 'tutor') ? 'tutor' : 'studente'));

                                fmtUser.id = sbUser.id;
                                fmtUser.google_id = sbUser.id;
                                fmtUser.email = sbUser.email;
                                fmtUser.google_email = sbUser.email;
                                fmtUser.role = unifiedRole;
                                fmtUser.auth_provider = 'unified';
                                fmtUser.linked = true;

                                if (typeof FMT_API !== 'undefined' && FMT_API.setCurrentUser) {
                                    FMT_API.setCurrentUser(fmtUser);
                                    FMT_API.syncGoogleAccount({
                                        id: sbUser.id,
                                        email: sbUser.email,
                                        full_name: fmtUser.full_name,
                                        role: unifiedRole,
                                        avatar_url: fmtUser.avatar_url
                                    });
                                }

                                if (unifiedRole !== cachedRole) {
                                    localStorage.setItem('fmt_role', unifiedRole);
                                    updateInterface(unifiedRole, fmtUser.avatar_url || cachedAvatar);
                                }
                            }
                        }
                    } catch (mergeErr) {
                        console.warn("Verifica unificazione Google/Mastercom:", mergeErr);
                    }
                })();

                // 1C. Controllo asincrono con il server
                if (typeof FMT_API !== 'undefined' && FMT_API.getMe) {
                    FMT_API.getMe().then(serverUser => {
                        if (serverUser) {
                            const verifiedRole = serverUser.role || 'studente';
                            const verifiedAvatar = serverUser.avatar_url || cachedAvatar;
                            if (verifiedRole !== lastRenderedRole || verifiedAvatar !== lastRenderedAvatar) {
                                localStorage.setItem('fmt_role', verifiedRole);
                                localStorage.setItem('fmt_avatar', verifiedAvatar);
                                updateInterface(verifiedRole, verifiedAvatar);
                            }
                        } else if (localStorage.getItem('fmt_token')) {
                            FMT_API.clearSession();
                            window.location.href = 'login.html';
                        }
                    }).catch(() => {});
                }

                return;
            }
        }

        // --- 2. CONTROLLO VELOCE SUPABASE (CACHE LOCALE) ---
        const cachedRole = localStorage.getItem('fmt_role');
        const cachedAvatar = localStorage.getItem('fmt_avatar');

        if (cachedRole) {
            updateInterface(cachedRole, cachedAvatar || 'https://via.placeholder.com/150');
        }

        // --- 3. CONTROLLO REALE (SUPABASE NETWORK IN BACKGROUND) ---
        const { data: { user } } = await sbClient.auth.getUser();

        if (user) {
            let userRole = 'studente';

            let { data: profile, error: profileError } = await sbClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

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
                } catch (syncErr) {}
            }

            const googleUserObj = mergedUser || {
                id: user.id,
                email: user.email,
                full_name: fullName,
                role: userRole,
                avatar_url: avatarUrl,
                auth_provider: 'google'
            };

            const finalRole = googleUserObj.role || userRole;
            const finalAvatar = googleUserObj.avatar_url || avatarUrl;

            if (typeof FMT_API !== 'undefined' && FMT_API.setCurrentUser) {
                FMT_API.setCurrentUser(googleUserObj);
            } else {
                localStorage.setItem('fmt_user', JSON.stringify(googleUserObj));
                localStorage.setItem('fmt_auth_provider', 'google');
            }
            localStorage.setItem('fmt_role', finalRole);
            localStorage.setItem('fmt_avatar', finalAvatar);

            updateInterface(finalRole, finalAvatar);

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

            // Controllo Ban
            try {
                const { data: banLog } = await sbClient
                    .from('banned_tutors_log')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('seen', false)
                    .maybeSingle();

                if (banLog) {
                    const modal = document.createElement('div');
                    modal.className = 'modal-overlay';
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
                        await sbClient
                            .from('banned_tutors_log')
                            .update({ seen: true })
                            .eq('id', banLog.id);
                        modal.remove();
                        window.location.reload();
                    };
                }
            } catch (e) {}

        } else {
            if (cachedRole && !isMastercom) {
                localStorage.removeItem('fmt_role');
                localStorage.removeItem('fmt_avatar');
                lastRenderedRole = null;
                const existingProfile = document.querySelector('.user-profile-header');
                if (existingProfile) {
                    existingProfile.outerHTML = `<a href="login.html" class="cta-btn" id="loginBtn"><i class="fas fa-sign-in-alt"></i> Accedi</a>`;
                }
            }
        }
    });
})();
