// ==========================================================================
// FIND MY TUTOR - NATIVE MOBILE APP NAVIGATION SYSTEM
// Direct architecture replica of EduTrack (new_registro_elettronico)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initEduTrackMobileInterface();

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 900) {
            initEduTrackMobileInterface();
        }
    });
});

function initEduTrackMobileInterface() {
    if (window.innerWidth > 900) return;

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const isLogin = path === 'login.html';
    
    // Su login page manteniamo l'interfaccia pulita senza barre
    if (isLogin) return;

    // Recupera utente e stato sessione
    let user = null;
    let role = 'studente';
    try {
        user = JSON.parse(localStorage.getItem('fmt_user') || localStorage.getItem('user') || 'null');
        role = localStorage.getItem('fmt_role') || (user?.role) || 'studente';
    } catch(e) {}

    const isLoggedIn = !!user || !!localStorage.getItem('fmt_token') || !!localStorage.getItem('fmt_role');
    const isMastercom = localStorage.getItem('fmt_auth_provider') === 'mastercom' || !!localStorage.getItem('fmt_token');

    // 1. Inietta Topbar nativa in stile EduTrack
    injectEduTrackTopbar(isLoggedIn, user, isMastercom, path);

    // 2. Inietta Bottom Nav in stile EduTrack
    injectEduTrackBottomNav(isLoggedIn, role, path);

    // 3. Inietta Overlay e More Menu Drawer (Altro)
    injectEduTrackMoreMenu(isLoggedIn, user, role);

    // 4. Gestione parametri query (?view=list)
    handleViewQueryParams(path);

    // 5. Inizializza Listeners
    initEduTrackListeners();
}

function getPageTitle(path) {
    switch (path) {
        case 'index.html':
        case '':
            return 'FindMyTutor';
        case 'prenota.html':
            return 'Agenda Studente';
        case 'dashboard.html':
            return 'Area Personale';
        case 'appuntamenti.html':
            return 'Agenda Tutor';
        case 'diventa_tutor.html':
            return 'Diventa Tutor';
        case 'progetto.html':
            return 'Il Progetto';
        case 'admin.html':
            return 'Pannello Admin';
        default:
            return 'FindMyTutor';
    }
}

function injectEduTrackTopbar(isLoggedIn, user, isMastercom, currentPath) {
    if (document.querySelector('.topbar')) return;

    const topbar = document.createElement('header');
    topbar.className = 'topbar';

    const pageTitle = getPageTitle(currentPath);
    const avatarUrl = user?.avatar_url || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';

    let rightActions = '';
    if (isLoggedIn) {
        rightActions = `
            ${isMastercom ? `
                <button class="tb-sync-btn" id="manual-sync-btn" title="Sincronizza Registro Elettronico">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            ` : ''}
            <a href="prenota.html?view=list" class="tb-notify-btn" title="Le tue Lezioni">
                <i class="fa-solid fa-bell"></i>
                <span class="tb-notify-dot hidden" id="tb-notify-dot"></span>
            </a>
            <a href="dashboard.html" class="tb-avatar" title="Vai all'Area Personale">
                <img src="${avatarUrl}" alt="Profilo">
                <span class="dot-online"></span>
            </a>
        `;
    } else {
        rightActions = `
            <a href="login.html" class="tb-login-pill">
                <i class="fa-solid fa-arrow-right-to-bracket"></i> <span>Accedi</span>
            </a>
        `;
    }

    topbar.innerHTML = `
        <div class="tb-left">
            <div class="tb-logo-icon">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <span class="tb-title" id="tb-page-title">${pageTitle}</span>
        </div>
        <div class="tb-right">
            ${rightActions}
        </div>
    `;

    document.body.prepend(topbar);
}

function injectEduTrackBottomNav(isLoggedIn, role, currentPath) {
    if (document.querySelector('.bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottom-nav';

    const isHome = currentPath === 'index.html' || currentPath === '';
    const isPrenota = currentPath === 'prenota.html';
    const isDashboard = currentPath === 'dashboard.html';
    const isAgenda = currentPath === 'appuntamenti.html';
    const isProgetto = currentPath === 'progetto.html';
    const isLogin = currentPath === 'login.html';

    let navItemsHtml = '';

    if (!isLoggedIn) {
        // NAV OSPITE
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-plus"></i><span>Prenota</span>
            </a>
            <a href="progetto.html" class="bn-item ${isProgetto ? 'is-active' : ''}">
                <i class="fa-solid fa-compass"></i><span>Progetto</span>
            </a>
            <a href="login.html" class="bn-item ${isLogin ? 'is-active' : ''}">
                <i class="fa-solid fa-arrow-right-to-bracket"></i><span>Accedi</span>
            </a>
            <a href="#" class="bn-item" id="bn-more">
                <i class="fa-solid fa-ellipsis"></i><span>Altro</span>
            </a>
        `;
    } else if (role === 'tutor' || role === 'admin') {
        // NAV TUTOR / ADMIN
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-plus"></i><span>Prenota</span>
            </a>
            <a href="appuntamenti.html" class="bn-item ${isAgenda ? 'is-active' : ''}">
                <i class="fa-solid fa-chalkboard-user"></i><span>Agenda</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
            <a href="#" class="bn-item" id="bn-more">
                <i class="fa-solid fa-ellipsis"></i><span>Altro</span>
            </a>
        `;
    } else {
        // NAV STUDENTE LOGGATO
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-plus"></i><span>Prenota</span>
            </a>
            <a href="prenota.html?view=list" class="bn-item" id="navItemLessonsMobile">
                <i class="fa-solid fa-calendar-check"></i><span>Lezioni</span>
                <span class="bn-badge hidden" id="bn-badge-count">0</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
            <a href="#" class="bn-item" id="bn-more">
                <i class="fa-solid fa-ellipsis"></i><span>Altro</span>
            </a>
        `;
    }

    nav.innerHTML = navItemsHtml;
    document.body.appendChild(nav);
}

function injectEduTrackMoreMenu(isLoggedIn, user, role) {
    if (document.querySelector('.more-menu')) return;

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // More Menu Drawer
    const moreMenu = document.createElement('div');
    moreMenu.className = 'more-menu';
    moreMenu.id = 'more-menu';

    const avatarUrl = user?.avatar_url || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';
    const userName = user?.full_name || (isLoggedIn ? 'Studente' : 'Visitatore');
    const userSub = isLoggedIn ? (role === 'admin' ? 'Amministratore' : (role === 'tutor' ? 'Tutor Ufficiale' : 'Studente Agnelli')) : 'FindMyTutor Agnelli';

    moreMenu.innerHTML = `
        <div class="more-menu-header">
            <div class="more-menu-user">
                <div class="tb-avatar" id="mm-avatar">
                    <img src="${avatarUrl}" alt="Avatar">
                </div>
                <div class="mm-user-text">
                    <h3 id="mm-username">${userName}</h3>
                    <small id="mm-user-sub">${userSub}</small>
                </div>
            </div>
            <button class="btn-close-more" id="close-more-menu" title="Chiudi menu">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="more-menu-grid">
            <a href="progetto.html" class="mm-item">
                <i class="fa-solid fa-compass"></i><span>Progetto</span>
            </a>
            <a href="diventa_tutor.html" class="mm-item">
                <i class="fa-solid fa-chalkboard-user"></i><span>Diventa Tutor</span>
            </a>
            <a href="dashboard.html" class="mm-item">
                <i class="fa-solid fa-award"></i><span>FSL</span>
            </a>
            <a href="https://registro.istitutoagnelli.it" target="_blank" rel="noopener" class="mm-item">
                <i class="fa-solid fa-school"></i><span>Registro</span>
            </a>
            <a href="mailto:staff.findmytutor@istitutoagnelli.it" class="mm-item">
                <i class="fa-solid fa-envelope"></i><span>Contatti</span>
            </a>
            ${role === 'admin' ? `
            <a href="admin.html" class="mm-item">
                <i class="fa-solid fa-shield-halved"></i><span>Admin</span>
            </a>` : `
            <a href="prenota.html" class="mm-item">
                <i class="fa-solid fa-book-open"></i><span>Materie</span>
            </a>`}
        </div>
        <div class="more-menu-footer">
            ${isLoggedIn ? `
                <button class="action-btn danger" id="logout-btn-mobile">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> Esci dall'account
                </button>
            ` : `
                <a href="login.html" class="action-btn primary" style="text-decoration:none;">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i> Accedi al Portale
                </a>
            `}
        </div>
    `;

    document.body.appendChild(moreMenu);
}

function initEduTrackListeners() {
    const bnMore = document.getElementById('bn-more');
    const moreMenu = document.getElementById('more-menu');
    const overlay = document.getElementById('sidebar-overlay');
    const closeMore = document.getElementById('close-more-menu');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    const manualSyncBtn = document.getElementById('manual-sync-btn');

    // Apri More Menu
    if (bnMore && moreMenu && overlay) {
        bnMore.addEventListener('click', (e) => {
            e.preventDefault();
            moreMenu.classList.add('is-active');
            overlay.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        });
    }

    // Chiudi More Menu
    const closeMenuFn = () => {
        if (moreMenu) moreMenu.classList.remove('is-active');
        if (overlay) overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    if (closeMore) closeMore.addEventListener('click', closeMenuFn);
    if (overlay) overlay.addEventListener('click', closeMenuFn);

    document.querySelectorAll('.mm-item').forEach(item => {
        item.addEventListener('click', closeMenuFn);
    });

    // Logout Mobile
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', async (e) => {
            e.preventDefault();
            closeMenuFn();
            if (typeof FMT_API !== 'undefined' && FMT_API.logout) {
                try { await FMT_API.logout(); } catch(err) {}
            }
            if (typeof sb !== 'undefined' && sb.auth) {
                try { await sb.auth.signOut(); } catch(err) {}
            }
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // Sincronizzazione Mastercom da Topbar
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', async () => {
            const icon = manualSyncBtn.querySelector('i');
            if (manualSyncBtn.classList.contains('is-syncing')) return;

            manualSyncBtn.classList.add('is-syncing');
            try {
                if (typeof FMT_API !== 'undefined' && FMT_API.syncProfile) {
                    const res = await FMT_API.syncProfile();
                    if (res.success && res.user) {
                        FMT_API.setCurrentUser(res.user);
                        window.location.reload();
                    } else {
                        alert(res.message || "Errore sincronizzazione.");
                    }
                }
            } catch (err) {
                alert("Errore sincronizzazione registro: " + err.message);
            } finally {
                manualSyncBtn.classList.remove('is-syncing');
            }
        });
    }

    // Previeni ricaricamenti inutili se si clicca la scheda della pagina attuale
    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.bn-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (!href || href === '#' || href.includes('?')) return;
            const targetFile = href.split('/').pop();
            if (targetFile === currentFile) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    // Aggiorna badge notifiche / lezioni
    updateLessonBadges();
}

function updateLessonBadges() {
    const badgeCountEl = document.getElementById('bn-badge-count');
    const notifyDot = document.getElementById('tb-notify-dot');
    const myLessonsBadge = document.getElementById('myLessonsBadge');

    let count = 0;
    if (myLessonsBadge) {
        count = parseInt(myLessonsBadge.textContent) || 0;
    }

    if (badgeCountEl) {
        if (count > 0) {
            badgeCountEl.textContent = count;
            badgeCountEl.classList.remove('hidden');
        } else {
            badgeCountEl.classList.add('hidden');
        }
    }

    if (notifyDot) {
        if (count > 0) {
            notifyDot.classList.remove('hidden');
        } else {
            notifyDot.classList.add('hidden');
        }
    }
}

function handleViewQueryParams(currentPath) {
    if (currentPath === 'prenota.html') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') === 'list') {
            setTimeout(() => {
                const btnViewList = document.getElementById('btnViewList');
                if (btnViewList) btnViewList.click();
            }, 100);
        }

        const navItemLessons = document.getElementById('navItemLessonsMobile');
        const navItemBooking = document.querySelector('.bn-item[href="prenota.html"]');

        if (navItemLessons) {
            navItemLessons.addEventListener('click', (e) => {
                e.preventDefault();
                const btnViewList = document.getElementById('btnViewList');
                if (btnViewList) btnViewList.click();
                document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('is-active'));
                navItemLessons.classList.add('is-active');
            });
        }

        if (navItemBooking) {
            navItemBooking.addEventListener('click', (e) => {
                e.preventDefault();
                const btnViewBooking = document.getElementById('btnViewBooking');
                if (btnViewBooking) btnViewBooking.click();
                document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('is-active'));
                navItemBooking.classList.add('is-active');
            });
        }
    }
}
