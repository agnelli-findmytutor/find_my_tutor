/**
 * FindMyTutor - PWA Native App Initialization
 */
(function() {
    // 1. Registra Service Worker
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then((reg) => {
                // Registrato con successo
            }).catch((err) => {
                console.warn('SW registration skipped:', err);
            });
        });
    }

    // Funzione helper: verifica se il viewport è mobile (<= 900px)
    function isMobileDevice() {
        return window.innerWidth <= 900;
    }

    // 2. Banner di Installazione Web App (Install Prompt) - RIGOROSAMENTE SOLO SU MOBILE
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Mostra SOLO se siamo su schermo mobile (<= 900px) e non è stato chiuso
        if (isMobileDevice() && !localStorage.getItem('fmt_pwa_dismissed') && !window.matchMedia('(display-mode: standalone)').matches) {
            showInstallAppBanner();
        }
    });

    // Se la finestra viene ridimensionata su desktop, rimuovi immediatamente il banner
    window.addEventListener('resize', () => {
        if (!isMobileDevice()) {
            const banner = document.getElementById('pwaInstallBanner');
            if (banner) banner.remove();
        }
    });

    function showInstallAppBanner() {
        // Blocco assoluto per schermi desktop
        if (!isMobileDevice()) return;
        if (document.getElementById('pwaInstallBanner')) return;

        const banner = document.createElement('div');
        banner.id = 'pwaInstallBanner';
        banner.className = 'pwa-install-toast';
        banner.innerHTML = `
            <div class="pwa-toast-content">
                <div class="pwa-toast-icon">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <div class="pwa-toast-info">
                    <h4>Installa FindMyTutor</h4>
                    <p>Aggiungi l'app alla schermata home per un accesso istantaneo e notifiche.</p>
                </div>
                <div class="pwa-toast-actions">
                    <button id="btnPwaInstall" class="btn-pwa-action install">Installa</button>
                    <button id="btnPwaDismiss" class="btn-pwa-action dismiss" aria-label="Chiudi"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        document.getElementById('btnPwaInstall')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                deferredPrompt = null;
                banner.remove();
            }
        });

        document.getElementById('btnPwaDismiss')?.addEventListener('click', () => {
            localStorage.setItem('fmt_pwa_dismissed', 'true');
            banner.remove();
        });
    }

    // 3. Prevenzione Pull-to-refresh fastidioso e doppi tocchi accidentali
    document.addEventListener('touchstart', () => {}, { passive: true });
})();
