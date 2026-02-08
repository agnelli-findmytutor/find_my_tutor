document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. ANIMAZIONI E VISIBILITÀ (PRIORITÀ MASSIMA)
    // ============================================================
    
    // Gestione Scroll Reveal (Fa apparire gli elementi nascosti)
    const observerOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                
                // Avvia contatori se necessario
                if (entry.target.classList.contains('stats') || entry.target.classList.contains('stats-dashboard')) {
                    startCounters();
                }
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Attiva l'osservatore su tutti gli elementi .reveal
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });

    // ============================================================
    // 2. FUNZIONI UI STANDARD (Header, Scroll, Carosello)
    // ============================================================

    // Header Scroll Effect
    const header = document.querySelector('header');
    if (header) {
        function handleHeaderScroll() {
            if (window.scrollY > 50) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        }
        handleHeaderScroll();
        window.addEventListener('scroll', handleHeaderScroll);
    }

    // Menu Active Link (Evidenzia la pagina corrente)
    const currentPage = window.location.pathname.split("/").pop() || "index.html"; 
    const navLinksItems = document.querySelectorAll('.nav-links a');
    navLinksItems.forEach(link => {
        if (link.getAttribute('href') === currentPage) link.classList.add('active');
    });

    // Animazione Numeri (Counters)
    function startCounters() {
        document.querySelectorAll('.counter').forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const increment = Math.ceil(target / 50);
            const updateCounter = () => {
                const c = +counter.innerText.replace('+', '');
                if (c < target) {
                    counter.innerText = (c + increment) + "+";
                    setTimeout(updateCounter, 30);
                } else {
                    counter.innerText = target + "+";
                }
            };
            updateCounter();
        });
    }

    // Gestione Carosello (se esiste nella pagina)
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length > 0) {
        let currentSlide = 0;
        const indicators = document.querySelectorAll('.indicator');
        const totalSlides = slides.length;
        const nextBtn = document.querySelector('.carousel-control.next');
        const prevBtn = document.querySelector('.carousel-control.prev');

        function showSlide(index) {
            if (index >= totalSlides) currentSlide = 0;
            else if (index < 0) currentSlide = totalSlides - 1;
            else currentSlide = index;

            slides.forEach(s => s.classList.remove('active'));
            indicators.forEach(i => i.classList.remove('active'));
            
            if(slides[currentSlide]) slides[currentSlide].classList.add('active');
            if(indicators[currentSlide]) indicators[currentSlide].classList.add('active');
        }

        if(nextBtn) nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
        if(prevBtn) prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
        indicators.forEach(i => i.addEventListener('click', (e) => showSlide(parseInt(e.target.dataset.slide))));
    }

    // Pulsante Scroll Top
    const scrollToTopBtn = document.getElementById("scrollToTop");
    if (scrollToTopBtn) {
        window.addEventListener("scroll", () => {
            scrollToTopBtn.classList.toggle("visible", window.scrollY > 300);
        });
        scrollToTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }


    // ============================================================
    // 3. GESTIONE MENU MOBILE AVANZATO (SIDEBAR)
    // ============================================================
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const headerActions = document.querySelector('.header-actions');
    const loginBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn') || document.querySelector('.user-profile-header'); 
    // Nota: loginBtn ora cerca anche .user-profile-header nel caso lo script gestione_utente.js abbia già fatto la sostituzione
    const overlay = document.querySelector('.overlay-menu');

    // Funzione per spostare il bottone Accedi (o Profilo) dentro/fuori dal menu mobile
    function moveLoginButton() {
        // Rileva l'elemento corrente (potrebbe essere cambiato da gestione_utente.js)
        const currentBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn') || document.querySelector('.user-profile-header');
        
        if (!currentBtn) return;

        if (window.innerWidth <= 900) {
            // MOBILE: Sposta nel menu laterale
            if (navLinks && !navLinks.contains(currentBtn)) {
                const liContainer = document.createElement('li');
                liContainer.className = 'mobile-login-wrapper';
                liContainer.appendChild(currentBtn);
                navLinks.appendChild(liContainer);
            }
        } else {
            // DESKTOP: Riporta nell'header
            if (navLinks && (navLinks.contains(currentBtn) || document.querySelector('.mobile-login-wrapper'))) {
                const wrapper = document.querySelector('.mobile-login-wrapper');
                if (wrapper) wrapper.remove();
                
                if(headerActions && menuToggle) {
                    headerActions.insertBefore(currentBtn, menuToggle);
                } else if (headerActions) {
                    headerActions.appendChild(currentBtn);
                }
            }
        }
    }

    // Esegui lo spostamento al caricamento e al ridimensionamento
    moveLoginButton();
    window.addEventListener('resize', moveLoginButton);

    // Gestione Apertura/Chiusura Menu
    if (menuToggle && navLinks) {
        const closeMenu = () => {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('active');
            if(overlay) overlay.classList.remove('active');
            document.body.style.overflow = ''; 
        };

        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
            if(overlay) overlay.classList.toggle('active');
            
            if (navLinks.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        if(overlay) overlay.addEventListener('click', closeMenu);

        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }
    // ============================================================
    // GESTIONE TRANSIZIONI PAGINA (SMOOTH NAVIGATION)
    // ============================================================
    
    // 1. Intercetta tutti i click sui link
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');

        // Se è un link valido, interno, e non apre una nuova scheda
        if (link && link.href && link.target !== '_blank' && !link.href.includes('#')) {
            
            // Controlla se è un link interno al tuo sito
            if (link.hostname === window.location.hostname) {
                e.preventDefault(); // FERMA il caricamento immediato

                // Aggiungi la classe che fa svanire la pagina
                document.body.classList.add('fade-out');

                // Aspetta che finisca l'animazione (300ms) poi cambia pagina
                setTimeout(() => {
                    window.location.href = link.href;
                }, 300);
            }
        }
    });

    // 2. Fix per il pulsante "Indietro" del browser
    // Se l'utente torna indietro, rimuovi la classe fade-out altrimenti la pagina resta invisibile
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            document.body.classList.remove('fade-out');
        }
    });
});