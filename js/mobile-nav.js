// ==========================================================================
// FIND MY TUTOR - NATIVE MOBILE NAVIGATION SYSTEM
// Riorganizzato con le stesse identiche pagine della versione desktop.
// Rimossi tutti i link non presenti su desktop (Registro, Contatti, FSL, Materie, Lezioni).
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initFmtMobileInterface();

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 900) {
            initFmtMobileInterface();
        }
    });
});

function initFmtMobileInterface() {
    if (window.innerWidth > 900) return;

    // Assicura che lo scorrimento della pagina non sia bloccato da overflow residui
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const isLogin = path === 'login.html';
    
    // Su login page manteniamo l'interfaccia pulita senza topbar/bottombar
    if (isLogin) return;

    // Recupera utente e stato sessione
    let user = null;
    let role = 'studente';
    try {
        user = JSON.parse(localStorage.getItem('fmt_user') || localStorage.getItem('user') || 'null');
        role = localStorage.getItem('fmt_role') || (user?.role) || 'studente';
    } catch(e) {}

    const isLoggedIn = !!user || !!localStorage.getItem('fmt_token') || !!localStorage.getItem('fmt_role');

    // 1. Inietta Topbar moderna
    injectFmtTopbar(isLoggedIn, user, path);

    // 2. Inietta Bottom Nav con le sole pagine autentiche di desktop
    injectFmtBottomNav(isLoggedIn, role, path);

    // 3. Inietta Overlay e Menu Drawer con tutte le pagine desktop
    injectFmtMoreMenu(isLoggedIn, user, role);

    // 4. Gestione parametri query (?view=list)
    handleViewQueryParams(path);

    // 5. Inizializza Listeners
    initFmtListeners();
}

function getPageTitle(path) {
    switch (path) {
        case 'index.html':
        case '':
            return 'FindMyTutor';
        case 'prenota.html':
            return 'Prenota Ripetizioni';
        case 'dashboard.html':
            return 'Area Personale';
        case 'appuntamenti.html':
            return 'Agenda Tutor';
        case 'diventa_tutor.html':
            return 'Diventa Tutor';
        case 'progetto.html':
            return 'Il nostro progetto';
        case 'staff.html':
            return 'Area Staff';
        case 'admin.html':
            return 'Pannello Admin';
        case 'login.html':
            return 'Accedi';
        default:
            return 'FindMyTutor';
    }
}

function injectFmtTopbar(isLoggedIn, user, currentPath) {
    if (document.querySelector('.topbar')) return;

    const topbar = document.createElement('header');
    topbar.className = 'topbar';

    const pageTitle = getPageTitle(currentPath);
    const avatarUrl = user?.avatar_url || localStorage.getItem('fmt_avatar') || 'https://via.placeholder.com/150';

    let rightActions = '';
    if (isLoggedIn) {
        rightActions = `
            <a href="dashboard.html" class="tb-avatar" title="Vai all'Area Personale">
                <img src="${avatarUrl}" alt="Profilo">
                <span class="dot-online"></span>
            </a>
            <button class="tb-action-btn" id="tb-menu-toggle" title="Menu di navigazione">
                <i class="fa-solid fa-bars"></i>
            </button>
        `;
    } else {
        rightActions = `
            <a href="login.html" class="tb-login-pill">
                <i class="fa-solid fa-arrow-right-to-bracket"></i> <span>Accedi</span>
            </a>
            <button class="tb-action-btn" id="tb-menu-toggle" title="Menu di navigazione">
                <i class="fa-solid fa-bars"></i>
            </button>
        `;
    }

    topbar.innerHTML = `
        <a href="index.html" class="tb-left" style="text-decoration:none; color:inherit;">
            <div class="tb-logo-icon">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <span class="tb-title" id="tb-page-title">${pageTitle}</span>
        </a>
        <div class="tb-right">
            ${rightActions}
        </div>
    `;

    document.body.prepend(topbar);
}

function injectFmtBottomNav(isLoggedIn, role, currentPath) {
    if (document.querySelector('.bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottom-nav';

    const isHome = currentPath === 'index.html' || currentPath === '';
    const isPrenota = currentPath === 'prenota.html';
    const isDashboard = currentPath === 'dashboard.html';
    const isAgenda = currentPath === 'appuntamenti.html';
    const isProgetto = currentPath === 'progetto.html';
    const isDiventa = currentPath === 'diventa_tutor.html';
    const isStaff = currentPath === 'staff.html';
    const isAdmin = currentPath === 'admin.html';
    const isLogin = currentPath === 'login.html';

    let navItemsHtml = '';

    if (!isLoggedIn) {
        // NAV OSPITE (5 pagine desktop principali)
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="progetto.html" class="bn-item ${isProgetto ? 'is-active' : ''}">
                <i class="fa-solid fa-project-diagram"></i><span>Progetto</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-check"></i><span>Prenota</span>
            </a>
            <a href="diventa_tutor.html" class="bn-item ${isDiventa ? 'is-active' : ''}">
                <i class="fa-solid fa-user-graduate"></i><span>Diventa Tutor</span>
            </a>
            <a href="login.html" class="bn-item ${isLogin ? 'is-active' : ''}">
                <i class="fa-solid fa-arrow-right-to-bracket"></i><span>Accedi</span>
            </a>
        `;
    } else if (role === 'tutor') {
        // NAV TUTOR
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="progetto.html" class="bn-item ${isProgetto ? 'is-active' : ''}">
                <i class="fa-solid fa-project-diagram"></i><span>Progetto</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-check"></i><span>Prenota</span>
            </a>
            <a href="appuntamenti.html" class="bn-item ${isAgenda ? 'is-active' : ''}">
                <i class="fa-solid fa-chalkboard-user"></i><span>Agenda</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
        `;
    } else if (role === 'staff') {
        // NAV STAFF
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="progetto.html" class="bn-item ${isProgetto ? 'is-active' : ''}">
                <i class="fa-solid fa-project-diagram"></i><span>Progetto</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-check"></i><span>Prenota</span>
            </a>
            <a href="staff.html" class="bn-item ${isStaff ? 'is-active' : ''}">
                <i class="fa-solid fa-user-tie"></i><span>Staff</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
        `;
    } else if (role === 'admin') {
        // NAV ADMIN
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-check"></i><span>Prenota</span>
            </a>
            <a href="appuntamenti.html" class="bn-item ${isAgenda ? 'is-active' : ''}">
                <i class="fa-solid fa-chalkboard-user"></i><span>Agenda</span>
            </a>
            <a href="admin.html" class="bn-item ${isAdmin ? 'is-active' : ''}">
                <i class="fa-solid fa-shield-halved"></i><span>Admin</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
        `;
    } else {
        // NAV STUDENTE (pagine desktop per studente)
        navItemsHtml = `
            <a href="index.html" class="bn-item ${isHome ? 'is-active' : ''}">
                <i class="fa-solid fa-house"></i><span>Home</span>
            </a>
            <a href="progetto.html" class="bn-item ${isProgetto ? 'is-active' : ''}">
                <i class="fa-solid fa-project-diagram"></i><span>Progetto</span>
            </a>
            <a href="prenota.html" class="bn-item ${isPrenota ? 'is-active' : ''}">
                <i class="fa-solid fa-calendar-check"></i><span>Prenota</span>
            </a>
            <a href="diventa_tutor.html" class="bn-item ${isDiventa ? 'is-active' : ''}">
                <i class="fa-solid fa-user-graduate"></i><span>Diventa Tutor</span>
            </a>
            <a href="dashboard.html" class="bn-item ${isDashboard ? 'is-active' : ''}">
                <i class="fa-solid fa-user"></i><span>Profilo</span>
            </a>
        `;
    }

    nav.innerHTML = navItemsHtml;
    document.body.appendChild(nav);
}

function injectFmtMoreMenu(isLoggedIn, user, role) {
    if (document.querySelector('.more-menu')) return;

    // Overlay oscurante
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
    const userSub = isLoggedIn
        ? (role === 'admin' ? 'Amministratore' : (role === 'staff' ? 'Staff FSL' : (role === 'tutor' ? 'Tutor Ufficiale' : 'Studente Agnelli')))
        : 'FindMyTutor Agnelli';

    // Pagine presenti ESCLUSIVAMENTE su Desktop
    const desktopPages = [
        { href: 'index.html', icon: 'fa-solid fa-house', label: 'Home' },
        { href: 'progetto.html', icon: 'fa-solid fa-project-diagram', label: 'Il nostro progetto' },
        { href: 'prenota.html', icon: 'fa-solid fa-calendar-check', label: 'Prenota Ripetizioni' },
        { href: 'diventa_tutor.html', icon: 'fa-solid fa-user-graduate', label: 'Diventa Tutor' },
        { href: isLoggedIn ? 'dashboard.html' : 'login.html', icon: 'fa-solid fa-user', label: isLoggedIn ? 'Area Personale' : 'Accedi' }
    ];

    if (role === 'tutor' || role === 'admin') {
        desktopPages.push({ href: 'appuntamenti.html', icon: 'fa-solid fa-chalkboard-user', label: 'Agenda Tutor' });
    }
    if (role === 'staff' || role === 'admin') {
        desktopPages.push({ href: 'staff.html', icon: 'fa-solid fa-user-tie', label: 'Area Staff' });
    }
    if (role === 'admin') {
        desktopPages.push({ href: 'admin.html', icon: 'fa-solid fa-shield-halved', label: 'Pannello Admin' });
    }

    const gridHtml = desktopPages.map(page => `
        <a href="${page.href}" class="mm-item">
            <i class="${page.icon}"></i><span>${page.label}</span>
        </a>
    `).join('');

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
            ${gridHtml}
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

function initFmtListeners() {
    const tbMenuToggle = document.getElementById('tb-menu-toggle');
    const bnMore = document.getElementById('bn-more');
    const moreMenu = document.getElementById('more-menu');
    const overlay = document.getElementById('sidebar-overlay');
    const closeMore = document.getElementById('close-more-menu');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');

    // Funzione apertura menu
    const openMenuFn = (e) => {
        if (e) e.preventDefault();
        if (moreMenu) moreMenu.classList.add('is-active');
        if (overlay) overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };

    // Funzione chiusura menu
    const closeMenuFn = () => {
        if (moreMenu) moreMenu.classList.remove('is-active');
        if (overlay) overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    };

    if (tbMenuToggle) {
        tbMenuToggle.addEventListener('click', openMenuFn);
    }
    if (bnMore) {
        bnMore.addEventListener('click', openMenuFn);
    }
    if (closeMore) {
        closeMore.addEventListener('click', closeMenuFn);
    }
    if (overlay) {
        overlay.addEventListener('click', closeMenuFn);
    }

    // Navigazione sicura e istantanea per le card del menu a cassetto
    document.querySelectorAll('.mm-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (!href || href === '#') return;
            e.preventDefault();
            closeMenuFn();
            window.location.href = href;
        });
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

    // Navigazione sicura e immediata per i pulsanti della barra inferiore
    document.querySelectorAll('.bn-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (!href || href === '#') return;

            // Se siamo già nella pagina attiva, effettua solo lo scroll in cima
            if (item.classList.contains('is-active')) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // Navigazione forzata e garantita al tocco
            e.preventDefault();
            window.location.href = href;
        });
    });
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
    }
}
