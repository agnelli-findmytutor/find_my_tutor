document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GESTIONE TAB SEGMENTATI ---
    const tabBtnLogin = document.getElementById('tabBtnLogin');
    const tabBtnInfo = document.getElementById('tabBtnInfo');
    const paneLogin = document.getElementById('paneLogin');
    const paneInfo = document.getElementById('paneInfo');
    const btnGoToLoginTab = document.getElementById('btnGoToLoginTab');

    function switchTab(target) {
        if (target === 'login') {
            tabBtnLogin?.classList.add('active');
            tabBtnLogin?.setAttribute('aria-selected', 'true');
            tabBtnInfo?.classList.remove('active');
            tabBtnInfo?.setAttribute('aria-selected', 'false');
            paneLogin?.classList.remove('hidden');
            paneInfo?.classList.add('hidden');
        } else {
            tabBtnInfo?.classList.add('active');
            tabBtnInfo?.setAttribute('aria-selected', 'true');
            tabBtnLogin?.classList.remove('active');
            tabBtnLogin?.setAttribute('aria-selected', 'false');
            paneInfo?.classList.remove('hidden');
            paneLogin?.classList.add('hidden');
        }
    }

    tabBtnLogin?.addEventListener('click', () => switchTab('login'));
    tabBtnInfo?.addEventListener('click', () => switchTab('info'));
    btnGoToLoginTab?.addEventListener('click', () => switchTab('login'));

    // --- 2. MOSTRA / NASCONDI PASSWORD ---
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const mcPasswordInput = document.getElementById('mcPassword');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');

    if (togglePasswordBtn && mcPasswordInput && togglePasswordIcon) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = mcPasswordInput.type === 'password';
            mcPasswordInput.type = isPassword ? 'text' : 'password';
            togglePasswordIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }

    // --- 3. ACCESSO CON MASTERCOM ---
    const mastercomLoginForm = document.getElementById('mastercomLoginForm');
    const submitBtn = document.getElementById('btnSubmitMastercom');
    const errorBanner = document.getElementById('loginErrorBanner');
    const errorText = document.getElementById('loginErrorText');
    const successBanner = document.getElementById('loginSuccessBanner');
    const successText = document.getElementById('loginSuccessText');

    if (mastercomLoginForm) {
        mastercomLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById('mcUsername');
            const username = usernameInput ? usernameInput.value.trim() : '';
            const password = mcPasswordInput ? mcPasswordInput.value : '';

            // Reset banner precedenti
            errorBanner?.classList.add('hidden');
            successBanner?.classList.add('hidden');

            if (!username || !password) {
                if (errorText) errorText.textContent = "Inserisci codice studente e password.";
                errorBanner?.classList.remove('hidden');
                return;
            }

            // Stato di caricamento
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Verifica credenziali in corso...</span>';

            try {
                const res = await FMT_API.loginMastercom(username, password);

                if (res.success && res.user) {
                    // Unificazione automatica istantanea se l'utente ha anche una sessione Google attiva
                    try {
                        const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
                        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';
                        if (typeof supabase !== 'undefined') {
                            const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                            const { data: { user: sbUser } } = await sb.auth.getUser();
                            if (sbUser && typeof FMT_API.namesOrEmailMatch === 'function') {
                                if (FMT_API.namesOrEmailMatch(res.user.full_name, sbUser.user_metadata?.full_name, sbUser.email)) {
                                    await FMT_API.syncGoogleAccount({
                                        id: sbUser.id,
                                        email: sbUser.email,
                                        full_name: res.user.full_name,
                                        role: res.user.role,
                                        avatar_url: sbUser.user_metadata?.avatar_url || res.user.avatar_url
                                    });
                                }
                            }
                        }
                    } catch (linkErr) {
                        console.warn("Auto-unificazione all'accesso Mastercom:", linkErr);
                    }

                    if (successText) {
                        successText.textContent = res.message || `Benvenuto, ${res.user.full_name}!`;
                    }
                    successBanner?.classList.remove('hidden');

                    submitBtn.innerHTML = '<i class="fas fa-check"></i> <span>Accesso riuscito!</span>';
                    submitBtn.style.background = '#16a34a';

                    setTimeout(() => {
                        window.location.href = 'prenota.html';
                    }, 600);
                } else {
                    throw new Error(res.message || "Credenziali non valide o servizio non raggiungibile.");
                }
            } catch (err) {
                console.error("Errore autenticazione Mastercom:", err);
                if (errorText) {
                    errorText.textContent = err.message || "Errore di connessione al server.";
                }
                errorBanner?.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
                submitBtn.style.background = '';
            }
        });
    }

    // --- 4. ACCESSO CON GOOGLE WORKSPACE (@istitutoagnelli.it) ---
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', async () => {
            const originalBtnHtml = btnGoogleLogin.innerHTML;
            btnGoogleLogin.disabled = true;
            btnGoogleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Reindirizzamento a Google...</span>';

            const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

            if (typeof supabase === 'undefined') {
                if (errorText) errorText.textContent = "Modulo di accesso Google non caricato. Ricarica la pagina.";
                errorBanner?.classList.remove('hidden');
                btnGoogleLogin.disabled = false;
                btnGoogleLogin.innerHTML = originalBtnHtml;
                return;
            }

            const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
            const redirectLink = isLocal
                ? window.location.origin + '/index.html'
                : 'https://agnelli-findmytutor.github.io/find_my_tutor/index.html';

            try {
                const { data, error } = await sb.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: redirectLink,
                        queryParams: {
                            prompt: 'select_account',
                            hd: 'istitutoagnelli.it'
                        }
                    }
                });
                if (error) throw error;
            } catch (err) {
                console.error("Errore Google OAuth:", err);
                if (errorText) errorText.textContent = "Errore durante l'accesso con Google: " + (err.message || err);
                errorBanner?.classList.remove('hidden');
                btnGoogleLogin.disabled = false;
                btnGoogleLogin.innerHTML = originalBtnHtml;
            }
        });
    }
});
