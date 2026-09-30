document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- SICUREZZA: ESCAPE HTML ---
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    let fmtUser = (typeof FMT_API !== 'undefined') ? FMT_API.getCurrentUser() : null;
    let hasMastercomData = !!fmtUser && !!fmtUser.username && !fmtUser.username.startsWith('g_') && Array.isArray(fmtUser.materie) && fmtUser.materie.length > 0;
    let user = null;
    let role = 'studente';

    let sbUser = null;
    try {
        const { data } = await sb.auth.getUser();
        sbUser = data?.user;
    } catch(e) {}

    if (sbUser) {
        user = sbUser;
        try {
            const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
            if (profile && profile.role) role = profile.role;
        } catch(e) {}

        if (fmtUser) {
            if (fmtUser.role === 'admin' || role === 'admin') role = 'admin';
            else if (fmtUser.role === 'tutor' || role === 'tutor') role = 'tutor';
        }
    } else if (fmtUser) {
        user = {
            id: fmtUser.google_id || fmtUser.id,
            email: fmtUser.google_email || fmtUser.email,
            user_metadata: {
                full_name: fmtUser.full_name,
                avatar_url: fmtUser.avatar_url
            }
        };
        role = fmtUser.role || 'studente';
    } else {
        window.location.href = "login.html";
        return;
    }

    // UI Setup
    const displayName = user.user_metadata?.full_name || fmtUser?.full_name || "Studente";
    const displayEmail = fmtUser?.google_email || user.email || fmtUser?.email || "";
    const displayAvatar = user.user_metadata?.avatar_url || fmtUser?.avatar_url || 'https://via.placeholder.com/150';

    document.getElementById('userName').textContent = displayName;
    document.getElementById('welcomeName').textContent = displayName.split(' ')[0];
    document.getElementById('userEmail').textContent = displayEmail;
    document.getElementById('userAvatar').src = displayAvatar;
    
    const badge = document.getElementById('profileRoleBadge');
    badge.className = `role-status-dot badge-${role}`;

    // Mostra sezione profilo Mastercom se utente possiede dati da registro
    const mcSection = document.getElementById('mastercomProfileSection');
    if (hasMastercomData && mcSection) {
        mcSection.classList.remove('hidden');
        const mcPhoto = document.getElementById('mcProfilePhoto');
        const mcName = document.getElementById('mcStudentName');
        const mcClass = document.getElementById('mcClassInfo');
        const mcCode = document.getElementById('mcStudentCode');
        const mcSubsContainer = document.getElementById('mcDashboardSubjects');

        if (mcPhoto) mcPhoto.src = fmtUser.avatar_url || 'https://via.placeholder.com/150';
        if (mcName) mcName.textContent = fmtUser.full_name;
        if (mcClass) mcClass.innerHTML = `<i class="fas fa-graduation-cap"></i> ${escapeHtml(fmtUser.class_info || `${fmtUser.class_year}° Anno ${fmtUser.school_type || ''}`)}`;
        if (mcCode) mcCode.innerHTML = `<i class="fas fa-id-badge"></i> Matricola: ${escapeHtml(fmtUser.username)}`;

        if (mcSubsContainer && fmtUser.materie) {
            mcSubsContainer.innerHTML = '';
            fmtUser.materie.forEach(m => {
                const chip = document.createElement('span');
                chip.className = 'mc-dash-chip';
                chip.innerHTML = `<i class="fas fa-book-reader"></i> ${escapeHtml(m)}`;
                mcSubsContainer.appendChild(chip);
            });
        }
    }

    // Mostra sezione profilo Google Workspace se utente collegato con Google o account unificato
    const googleSection = document.getElementById('googleProfileSection');
    const isGoogleLinked = !!sbUser || (fmtUser && fmtUser.google_id) || (fmtUser && fmtUser.auth_provider === 'unified');
    if (googleSection && isGoogleLinked) {
        googleSection.classList.remove('hidden');
        const gPhoto = document.getElementById('googleProfilePhoto');
        const gName = document.getElementById('googleStudentName');
        const gEmail = document.getElementById('googleStudentEmail');
        const gRole = document.getElementById('googleStudentRole');

        if (gPhoto) gPhoto.src = displayAvatar;
        if (gName) gName.textContent = displayName;
        if (gEmail) gEmail.innerHTML = `<i class="fas fa-envelope"></i> ${escapeHtml(displayEmail)}`;
        if (gRole) {
            const roleLabel = role === 'admin' ? 'Amministratore' : (role === 'tutor' ? 'Studente Tutor' : 'Studente');
            gRole.innerHTML = `<i class="fas fa-user-graduate"></i> ${roleLabel}`;
        }
    }

    // --- GESTIONE BANNER E MODALE SUGGERIMENTO COLLEGAMENTO MASTERCOM ---
    const connectCard = document.getElementById('connectMastercomCard');
    const modalConnect = document.getElementById('modalConnectMastercom');
    const btnOpenConnect = document.getElementById('btnOpenConnectMastercom');
    const btnCancelConnect = document.getElementById('btnCancelConnectMc');
    const formConnect = document.getElementById('formConnectMastercom');
    const btnSubmitConnect = document.getElementById('btnSubmitConnectMc');
    const errorBannerConnect = document.getElementById('connectMcErrorBanner');
    const errorTextConnect = document.getElementById('connectMcErrorText');
    const pwInputConnect = document.getElementById('mcConnectPassword');
    const btnTogglePwConnect = document.getElementById('btnToggleConnectPw');
    const iconTogglePwConnect = document.getElementById('toggleConnectPwIcon');

    // Mostra il suggerimento solo se l'utente non ha ancora i dati del registro collegati
    if (connectCard) {
        if (!hasMastercomData) {
            connectCard.classList.remove('hidden');
        } else {
            connectCard.classList.add('hidden');
        }
    }

    if (btnOpenConnect && modalConnect) {
        btnOpenConnect.addEventListener('click', () => {
            errorBannerConnect?.classList.add('hidden');
            formConnect?.reset();
            modalConnect.classList.remove('hidden');
            document.getElementById('mcConnectUsername')?.focus();
        });
    }

    if (btnCancelConnect && modalConnect) {
        btnCancelConnect.addEventListener('click', () => {
            modalConnect.classList.add('hidden');
        });
    }

    // Toggle password
    if (btnTogglePwConnect && pwInputConnect && iconTogglePwConnect) {
        btnTogglePwConnect.addEventListener('click', () => {
            const isPw = pwInputConnect.type === 'password';
            pwInputConnect.type = isPw ? 'text' : 'password';
            iconTogglePwConnect.className = isPw ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // Invio credenziali per collegare Mastercom
    if (formConnect) {
        formConnect.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('mcConnectUsername');
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = pwInputConnect ? pwInputConnect.value : '';

            errorBannerConnect?.classList.add('hidden');

            if (!username || !password) {
                if (errorTextConnect) errorTextConnect.textContent = "Compila tutti i campi richiesti.";
                errorBannerConnect?.classList.remove('hidden');
                return;
            }

            const originalBtnHtml = btnSubmitConnect.innerHTML;
            btnSubmitConnect.disabled = true;
            btnSubmitConnect.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Verifica in corso...</span>';

            try {
                // 1. Esegui autenticazione con Mastercom
                const mcRes = await FMT_API.loginMastercom(username, password);
                if (!mcRes || !mcRes.success || !mcRes.user) {
                    throw new Error(mcRes?.message || "Credenziali Mastercom non corrette.");
                }

                // 2. Unifica l'account Google con il profilo Mastercom
                if (typeof FMT_API.syncGoogleAccount === 'function') {
                    await FMT_API.syncGoogleAccount({
                        id: user.id,
                        email: user.email,
                        full_name: mcRes.user.full_name || displayName,
                        role: role,
                        avatar_url: displayAvatar
                    });
                }

                btnSubmitConnect.innerHTML = '<i class="fas fa-check"></i> <span>Collegato!</span>';
                btnSubmitConnect.style.background = '#16a34a';

                setTimeout(() => {
                    modalConnect.classList.add('hidden');
                    window.location.reload();
                }, 700);

            } catch (err) {
                console.error("Errore collegamento Mastercom:", err);
                if (errorTextConnect) {
                    errorTextConnect.textContent = err.message || "Errore di connessione o credenziali errate.";
                }
                errorBannerConnect?.classList.remove('hidden');
                btnSubmitConnect.disabled = false;
                btnSubmitConnect.innerHTML = originalBtnHtml;
                btnSubmitConnect.style.background = '';
            }
        });
    }

    // Listener Bottone Sincronizzazione Registro in Header
    const btnSyncDash = document.getElementById('btnSyncDashboard');
    if (!hasMastercomData && btnSyncDash) {
        btnSyncDash.classList.add('hidden');
    }
    if (btnSyncDash) {
        btnSyncDash.onclick = async () => {
            const icon = document.getElementById('dashSyncIcon');
            if (icon) icon.classList.add('fa-spin');
            btnSyncDash.disabled = true;

            try {
                const res = await FMT_API.syncProfile();
                if (res.success && res.user) {
                    FMT_API.setCurrentUser(res.user);
                    alert("Sincronizzazione completata! Orario e materie aggiornati dal Registro Elettronico.");
                    window.location.reload();
                } else {
                    alert(res.message || "Errore durante la sincronizzazione.");
                }
            } catch (err) {
                alert("Errore sincronizzazione: " + err.message);
            } finally {
                if (icon) icon.classList.remove('fa-spin');
                btnSyncDash.disabled = false;
            }
        };
    }

    // Mostra/Nascondi elementi in base al ruolo
    if (role === 'tutor' || role === 'admin') {
        document.getElementById('btnAgendaTutor').classList.remove('hidden');
        document.getElementById('navFSL').classList.remove('hidden');
        document.getElementById('btnDowngrade').classList.remove('hidden');
        document.getElementById('tutorLessonsSection').classList.remove('hidden');
        document.getElementById('tutorRatingSection').classList.remove('hidden');
        loadTutorData(user.id);
        loadFSLData(user.id);
    }

    // 2. Caricamento Lezioni Studente (Lezioni che frequento)
    async function loadStudentLessons() {
        const container = document.getElementById('studentLessonsList');
        let lessons = [];

        if (isMastercomUser) {
            const res = await FMT_API.getAppointments(user.id);
            const today = new Date().toISOString().split('T')[0];
            const rawList = Array.isArray(res) ? res : ((res && res.appointments) ? res.appointments : []);
            lessons = rawList
                .filter(l => l.status === 'Confermato' && l.date >= today)
                .slice(0, 3);
        } else {
            const { data: sbLessons } = await sb.from('appointments')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'Confermato')
                .gte('date', new Date().toISOString().split('T')[0])
                .order('date', { ascending: true })
                .limit(3);
            lessons = sbLessons || [];
        }

        if (lessons && lessons.length > 0) {
            container.innerHTML = '';
            lessons.forEach(l => {
                const isGroup = l.is_group;
                const style = isGroup ? 'border-left: 4px solid #1565C0; background: #E3F2FD;' : '';
                
                const groupInfo = isGroup && l.group_members 
                    ? (() => {
                        if (l.group_members.startsWith("Organizzato da ")) {
                            const org = l.group_members.replace("Organizzato da ", "").split(" | ")[0];
                            return `<p style="font-size:0.75rem; color:#1565C0; margin-top:2px;"><i class="fas fa-crown"></i> Org: ${escapeHtml(org)}</p>`;
                        }
                        return `<p style="font-size:0.75rem; color:#1565C0; margin-top:2px;"><i class="fas fa-crown"></i> Org: Tu</p>`;
                      })()
                    : '';
                
                container.innerHTML += `
                    <div class="mini-lesson-card" style="${style}">
                        <div class="info">
                            <h4>${escapeHtml(l.subject)}</h4>
                            <p>Tutor: ${escapeHtml(l.tutor_name_cache)}</p>
                            ${groupInfo}
                        </div>
                        <div class="time-tag">${l.date.split('-').reverse().join('/')}</div>
                    </div>`;
            });
        }
    }

    // 3. Caricamento Lezioni Tutor (Lezioni che insegno)
    async function loadTutorData(tutorId) {
        const container = document.getElementById('tutorLessonsList');
        const { data: lessons } = await sb.from('appointments')
            .select('*')
            .eq('tutor_id', tutorId)
            .eq('status', 'Confermato')
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .limit(3);

        if (lessons && lessons.length > 0) {
            // Raggruppa per la dashboard tutor (Logica migliorata)
            const grouped = [];
            const map = new Map();
            lessons.forEach(l => {
                const key = `${l.date}_${l.time_slot}`;
                if (l.is_group) {
                    if (map.has(key)) {
                        const existing = map.get(key);
                        if (!existing.all_students.includes(l.student_name)) {
                            existing.all_students.push(l.student_name);
                        }
                        if (l.group_members && l.group_members.startsWith("Organizzato da ")) {
                            existing.organizer_name = l.group_members.replace("Organizzato da ", "").split(" | ")[0];
                        }
                    } else {
                        const copy = { ...l };
                        copy.all_students = [l.student_name];
                        copy.organizer_name = (l.group_members && l.group_members.startsWith("Organizzato da ")) 
                            ? l.group_members.replace("Organizzato da ", "").split(" | ")[0] 
                            : l.student_name;
                        map.set(key, copy);
                        grouped.push(copy);
                    }
                } else {
                    grouped.push(l);
                }
            });

            container.innerHTML = '';
            grouped.slice(0, 3).forEach(l => {
                const isGroup = l.is_group;
                const style = isGroup ? 'border-left: 4px solid #1565C0; background: #E3F2FD;' : 'border-left: 4px solid #4a148c;';
                
                const studentText = isGroup 
                    ? `Org: ${escapeHtml(l.organizer_name)} (+${l.all_students.length - 1})`
                    : `Studente: ${escapeHtml(l.student_name)}`;

                container.innerHTML += `
                    <div class="mini-lesson-card" style="${style}">
                        <div class="info">
                            <h4>${escapeHtml(l.subject)}</h4>
                            <p>${studentText}</p>
                        </div>
                        <div class="time-tag" style="background: #f3e5f5; color: #4a148c;">${l.time_slot}</div>
                    </div>`;
            });
        }

        // --- CARICAMENTO RECENSIONI REALI ---
        const { data: ratings } = await sb.from('tutor_ratings').select('rating').eq('tutor_id', tutorId);
        
        let avg = 0;
        if (ratings && ratings.length > 0) {
            avg = (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1);
        }

        const starsContainer = document.getElementById('tutorStars');
        starsContainer.innerHTML = '';
        for(let i=0; i<5; i++) {
            starsContainer.innerHTML += i < Math.round(avg) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        }
        document.getElementById('ratingText').textContent = ratings.length > 0 ? `Media: ${avg}/5 (${ratings.length} voti)` : "Nessuna recensione";
    }

    // --- CARICAMENTO E CALCOLO FSL ---
    async function loadFSLData(tutorId) {
        const today = new Date().toISOString().split('T')[0];
        // Prendiamo solo le lezioni passate e confermate
        const { data: lessons } = await sb.from('appointments')
            .select('duration')
            .eq('tutor_id', tutorId)
            .eq('status', 'Confermato')
            .lt('date', today);

        let totalMinutes = 0;
        if (lessons) {
            lessons.forEach(l => {
                // duration è salvata come "60 min" o "90 min"
                totalMinutes += parseInt(l.duration) || 0;
            });
        }

        const hours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;

        document.getElementById('FSLHours').textContent = hours;
        
        const extraBox = document.getElementById('FSLExtraMinutes');
        if (remainingMinutes > 0) {
            extraBox.classList.remove('hidden');
        } else {
            extraBox.classList.add('hidden');
        }
    }

    // --- GESTIONE NAVIGAZIONE INTERNA (TABS) ---
    window.switchDashboardTab = (tabId) => {
        document.querySelectorAll('.dashboard-tab-content').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        document.getElementById('tab-' + tabId).classList.remove('hidden');
        if(tabId === 'overview') document.getElementById('navDashboard').classList.add('active');
        if(tabId === 'FSL') document.getElementById('navFSL').classList.add('active');
    };

    // Listener Sidebar
    document.getElementById('navDashboard').onclick = (e) => { e.preventDefault(); switchDashboardTab('overview'); };
    document.getElementById('navFSL').onclick = (e) => { e.preventDefault(); switchDashboardTab('FSL'); };

    // 4. Gestione Pulsanti Logout (Desktop e Mobile)
    const performLogout = async () => {
        if (typeof FMT_API !== 'undefined') {
            try { await FMT_API.logout(); } catch (e) {}
        }
        try { await sb.auth.signOut(); } catch (e) {}
        localStorage.clear();
        window.location.href = "login.html";
    };

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = performLogout;

    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) mobileLogoutBtn.onclick = performLogout;

    // --- GESTIONE DOWNGRADE (NUOVA LOGICA A 2 STEP) ---

    // Apre il primo modale
    document.getElementById('btnDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.remove('hidden');
    };

    // Chiude il primo modale (Annulla Step 1)
    document.getElementById('btnCancelDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.add('hidden');
    };

    // Conferma Step 1 -> Passa a Step 2
    document.getElementById('btnConfirmDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.add('hidden');
        document.getElementById('downgradeStep2Modal').classList.remove('hidden');
    };

    // Chiude il secondo modale (Annulla Step 2)
    document.getElementById('btnCancelDowngrade2').onclick = () => {
        document.getElementById('downgradeStep2Modal').classList.add('hidden');
    };

    // Conferma Finale Downgrade (Esegue update su DB)
    document.getElementById('btnFinalConfirmDowngrade').onclick = async () => {
        const { error } = await sb.from('profiles').update({ role: 'studente' }).eq('id', user.id);
        if (!error) {
            document.getElementById('downgradeStep2Modal').classList.add('hidden');
            document.getElementById('successModal').classList.remove('hidden');
            localStorage.setItem('fmt_role', 'studente'); // Aggiorna la cache locale
        } else {
            alert("Errore durante il downgrade: " + error.message);
        }
    };

    // Chiude modale successo e ricarica
    document.getElementById('btnSuccessClose').onclick = () => window.location.reload();

    // --- GESTIONE DELETE ACCOUNT (NUOVA LOGICA MODALE) ---

    // Apre il modale di cancellazione (invece del confirm nativo)
    document.getElementById('deleteBtn').onclick = () => {
        document.getElementById('deleteAccountModal').classList.remove('hidden');
    };

    // Annulla cancellazione (Chiude modale)
    document.getElementById('btnCancelDelete').onclick = () => {
        document.getElementById('deleteAccountModal').classList.add('hidden');
    };

    // Conferma cancellazione (Chiama la funzione)
    document.getElementById('btnConfirmDeleteAccount').onclick = async () => {
        await deleteAccount();
    };

    // Funzione effettiva di cancellazione
    async function deleteAccount() {
        try {
            // Chiamiamo la funzione SQL personalizzata per eliminare l'utente da Authentication e Profiles
            const { error } = await sb.rpc('delete_self');
            if (error) throw error;
            localStorage.clear();
            
            alert("Account eliminato correttamente.");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Errore cancellazione:", error);
            // Mostra l'errore reale per il debug
            alert("Errore durante l'eliminazione: " + (error.message || "Riprova più tardi."));
            // Chiudi il modale anche in caso di errore per evitare blocco UI
            document.getElementById('deleteAccountModal').classList.add('hidden');
        }
    }

    // Avvio caricamento dati
    loadStudentLessons();
});
