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
    // 2. GESTIONE UTENTE E SUPABASE (PROFILO)
    // ============================================================
    
    // Mettiamo tutto in un try-catch per non bloccare il sito se Supabase fallisce
    try {
        if (typeof supabase !== 'undefined') {
            const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
            // La tua chiave ANON
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';
            
            const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            // Controlla utente loggato
            supabaseClient.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    console.log("Utente loggato:", user.email);
                    const loginBtn = document.getElementById('loginBtn') || document.querySelector('.header-actions .cta-btn');
                    
                    if (loginBtn) {
                        const avatarUrl = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
                        // Sostituisci pulsante con foto
                        loginBtn.outerHTML = `
                            <a href="dashboard.html" title="Il mio Profilo" style="display: block;">
                                <img src="${avatarUrl}" alt="Profilo" class="profile-pic-header">
                            </a>
                        `;
                    }
                }
                const navLinks = document.querySelector('.nav-links');
        
        if (navLinks) {
            // Crea il nuovo elemento della lista
            const newLi = document.createElement('li');
            
            // Inserisci il link (non serve creare la pagina ora, darà 404 se cliccato)
            newLi.innerHTML = '<a href="appuntamenti.html">I tuoi appuntamenti</a>';
            
            // DECIDI DOVE INSERIRLO:
            // navLinks.children[2] lo inserisce come TERZA voce (dopo Home e Progetto)
            // Se vuoi metterlo in fondo, usa navLinks.appendChild(newLi);
            
            // Lo inseriamo prima del terzo elemento esistente (es. prima di "Diventa Tutor")
            navLinks.insertBefore(newLi, navLinks.children[2]);
        }
            });
        } else {
            console.warn("Libreria Supabase non trovata nell'HTML.");
        }
    } catch (err) {
        console.error("Errore inizializzazione Supabase:", err);
    }

    // ============================================================
    // 3. FUNZIONI UI STANDARD (Header, Menu, Carosello)
    // ============================================================

    // Header Scroll Effect
    const header = document.querySelector('header');
    function handleHeaderScroll() {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    }
    handleHeaderScroll();
    window.addEventListener('scroll', handleHeaderScroll);

    // Menu Active Link
    const currentPage = window.location.pathname.split("/").pop() || "index.html"; 
    const navLinksItems = document.querySelectorAll('.nav-links a');
    navLinksItems.forEach(link => {
        if (link.getAttribute('href') === currentPage) link.classList.add('active');
    });

    // Menu Mobile
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (navLinks.classList.contains('active')) {
                Object.assign(navLinks.style, {
                    display: 'flex', flexDirection: 'column', position: 'absolute',
                    top: '100%', left: '0', width: '100%', background: 'white',
                    padding: '2rem', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', textAlign: 'center'
                });
            } else {
                navLinks.style.display = '';
            }
        });
    }

    // Animazione Numeri
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

    // Gestione Carosello (se esiste)
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
            slides[currentSlide].classList.add('active');
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

});