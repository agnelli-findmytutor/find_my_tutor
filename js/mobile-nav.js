// ============================================================
// MOBILE APP NAVIGATION MANAGER
// Injects bottom navigation and top bar based on context
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Check if we are on mobile (can trigger on resize too)
    if (window.innerWidth <= 900) {
        initMobileInterface();
    }
    
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 900) {
            if (!document.querySelector('.mobile-bottom-nav')) initMobileInterface();
        } else {
            // Optional: remove mobile elements if resizing to desktop
            // document.querySelector('.mobile-bottom-nav')?.remove();
            // document.querySelector('.mobile-top-bar')?.remove();
        }
    });
});

function initMobileInterface() {
    // 1. Determine Context (Public, Dashboard (Student/Tutor), Admin)
    const path = window.location.pathname;
    const isDashboard = path.includes('dashboard.html') || path.includes('appuntamenti.html') || path.includes('prenota.html');
    const isAdmin = path.includes('admin.html');
    const isLogin = path.includes('login.html');
    
    // Do not inject on Login page (keep it clean)
    if (isLogin) return;

    // 2. Inject Top Bar (Logo + Profile/Logout)
    injectTopBar(isDashboard, isAdmin);

    // 3. Inject Bottom Nav
    if (isAdmin) {
        injectAdminNav();
    } else if (isDashboard) {
        injectDashboardNav();
    } else {
        injectPublicNav();
    }
    
    // 4. Highlight Active Link
    highlightActiveLink();
}

function injectTopBar(isDashboard, isAdmin) {
    if (document.querySelector('.mobile-top-bar')) return;

    const topBar = document.createElement('div');
    topBar.className = 'mobile-top-bar';
    
    let title = 'FindMyTutor';
    let rightIcon = '<a href="login.html" style="color:#D32F2F; font-weight:600; font-size:0.9rem;">Accedi</a>';
    
    // Check auth state from localStorage (simple check)
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (user || isDashboard || isAdmin) {
        rightIcon = `
            <a href="${isAdmin ? 'admin.html' : 'dashboard.html'}" class="profile-icon-top" style="
                width: 35px; height: 35px; background: #eee; border-radius: 50%; 
                display: flex; justify-content: center; align-items: center; color: #555;
            ">
                <i class="fas fa-user"></i>
            </a>
        `;
    }

    if (isAdmin) title = 'Admin Panel';
    
    topBar.innerHTML = `
        <div class="mobile-logo">
            <i class="fas fa-graduation-cap"></i>
            <span>${title}</span>
        </div>
        <div class="mobile-actions">
            ${rightIcon}
        </div>
    `;
    
    // Insert at the very top of body
    document.body.prepend(topBar);
}

function injectPublicNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;
    
    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
        <a href="index.html" class="nav-item-mobile">
            <i class="fas fa-home"></i>
            <span>Home</span>
        </a>
        <a href="progetto.html" class="nav-item-mobile">
            <i class="fas fa-info-circle"></i>
            <span>Progetto</span>
        </a>
        <a href="prenota.html" class="nav-item-mobile highlight-action">
             <i class="fas fa-search"></i>
        </a>
        <a href="diventa_tutor.html" class="nav-item-mobile">
            <i class="fas fa-chalkboard-teacher"></i>
            <span>Tutor</span>
        </a>
        <a href="dashboard.html" class="nav-item-mobile">
            <i class="fas fa-user"></i>
            <span>Area</span>
        </a>
    `;
    document.body.appendChild(nav);
}

function injectDashboardNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
        <a href="index.html" class="nav-item-mobile">
            <i class="fas fa-home"></i>
            <span>Home</span>
        </a>
        <a href="dashboard.html" class="nav-item-mobile">
            <i class="fas fa-th-large"></i>
            <span>Dash</span>
        </a>
        <a href="prenota.html" class="nav-item-mobile highlight-action">
             <i class="fas fa-plus"></i>
        </a>
        <a href="appuntamenti.html" class="nav-item-mobile">
            <i class="fas fa-calendar-check"></i>
            <span>Agenda</span>
        </a>
        <button id="mobileLogout" class="nav-item-mobile" style="background:none; border:none; cursor:pointer;">
            <i class="fas fa-sign-out-alt"></i>
            <span>Esci</span>
        </button>
    `;
    document.body.appendChild(nav);
    
    // Bind Logout
    setTimeout(() => {
        document.getElementById('mobileLogout')?.addEventListener('click', () => {
             if(confirm('Vuoi davvero uscire?')) {
                 localStorage.removeItem('user');
                 localStorage.removeItem('sb-access-token');
                 window.location.href = 'index.html';
             }
        });
    }, 500);
}

function injectAdminNav() {
    if (document.querySelector('.mobile-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `
        <a href="admin.html" class="nav-item-mobile">
            <i class="fas fa-chart-line"></i>
            <span>Stats</span>
        </a>
        <a href="admin.html?tab=users" class="nav-item-mobile">
            <i class="fas fa-users"></i>
            <span>Utenti</span>
        </a>
        <a href="admin.html?tab=lessons" class="nav-item-mobile highlight-action" style="background: #4a148c;">
             <i class="fas fa-list"></i>
        </a>
        <a href="admin.html?tab=requests" class="nav-item-mobile">
            <i class="fas fa-user-plus"></i>
            <span>Richieste</span>
        </a>
        <a href="dashboard.html" class="nav-item-mobile">
            <i class="fas fa-arrow-left"></i>
            <span>Esci</span>
        </a>
    `;
    document.body.appendChild(nav);
}

function highlightActiveLink() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.nav-item-mobile');
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        // Simple match or query param match for admin tabs
        if (href === path || (path === 'admin.html' && href.includes('admin.html'))) {
            // Avoid highlighting multiple admin tabs if not precise, but for now simple is ok
            link.classList.add('active');
        }
    });
}
