// ============================================================
// 🛡️ ANTI-CHEAT & SECURITY MONITOR
// Intercetta tentativi di hacking dalla console o azioni non autorizzate
// ============================================================
(function() {
    // Se Supabase non è caricato, non fare nulla
    if (typeof window.supabase === 'undefined') return console.warn("Supabase not loaded, anti-cheat disabled");

    const originalCreateClient = window.supabase.createClient;
    
    // Sovrascriviamo la funzione createClient per iniettare il controllo
    window.supabase.createClient = function(...args) {
        const client = originalCreateClient.apply(this, args);
        
        // Funzione che "avvolge" i costruttori di query (select, update, etc.)
        const proxyBuilder = (builder) => {
            return new Proxy(builder, {
                get(target, prop) {
                    // Intercettiamo il 'then' (quando la query viene eseguita)
                    if (prop === 'then') {
                        return function(onFulfilled, onRejected) {
                            return target.then(response => {
                                // 🚨 CONTROLLO SICUREZZA QUI 🚨
                                if (response && response.error) {
                                    checkSecurityViolation(response.error);
                                }
                                if (onFulfilled) return onFulfilled(response);
                                return response;
                            }, onRejected);
                        }
                    }
                    
                    // Continua la catena (es. .eq().select()...) mantenendo il proxy
                    const value = target[prop];
                    if (typeof value === 'function') {
                        return function(...args) {
                            const result = value.apply(this, args);
                            if (result && typeof result.then === 'function') {
                                return proxyBuilder(result);
                            }
                            return result;
                        }
                    }
                    return value;
                }
            });
        };

        // Proxy sul client principale (intercetta .from() e .rpc())
        return new Proxy(client, {
            get(target, prop) {
                const value = target[prop];
                if (typeof value === 'function' && (prop === 'from' || prop === 'rpc')) {
                    return function(...args) {
                        return proxyBuilder(value.apply(this, args));
                    }
                }
                return value;
            }
        });
    };

    function checkSecurityViolation(error) {
        // Codice 42501: RLS Policy Violation (Permesso Negato dal DB)
        // Codice P0001: Raise Exception (Il nostro Trigger Anti-Hacker)
        if (error.code === '42501' || (error.code === 'P0001' && error.message.includes('Cucciolo provaci di nuovo e vedrai che te la mettiamo nel culo'))) {
            console.clear(); // Pulisce la console per confondere l'hacker
            showHackerModal(error.message);
        }
    }

    function showHackerModal(msg) {
        if(document.getElementById('hackerModal')) return;
        const modal = document.createElement('div');
        modal.id = 'hackerModal';
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(10px); animation: fadeIn 0.2s;";
        modal.innerHTML = `<div style="background: #fff; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; border-bottom: 8px solid #D32F2F; box-shadow: 0 0 80px rgba(211, 47, 47, 0.6); transform: scale(1.1);"><div style="font-size: 5rem; color: #D32F2F; margin-bottom: 20px;"><i class="fas fa-user-secret"></i></div><h1 style="color: #D32F2F; font-family: 'Poppins', sans-serif; font-weight: 800; text-transform: uppercase; margin-bottom: 10px; font-size: 1.8rem;">Proviamo a fare i furbi, eh?</h1><p style="font-size: 1.1rem; color: #333; margin-bottom: 20px; font-weight: 500;">Il sistema ha rilevato un tentativo di modifica non autorizzata o un comando illegale dalla console.</p><div style="background: #ffebee; color: #b71c1c; padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.85rem; margin-bottom: 25px; border: 1px solid #ffcdd2;"><strong>Security Alert:</strong> ${msg || 'Access Denied'}</div><button onclick="location.reload()" style="background: #D32F2F; color: white; border: none; padding: 15px 40px; font-size: 1.1rem; font-weight: bold; border-radius: 50px; cursor: pointer; transition: 0.3s; box-shadow: 0 5px 15px rgba(211, 47, 47, 0.4);"><i class="fas fa-sync-alt"></i> Ricarica Pagina</button></div>`;
        document.body.appendChild(modal);
    }
})();

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

// Funzione globale per copiare testo (usata in appuntamenti.html)
function copyText(text) {
    const showToast = () => {
        const toast = document.getElementById("toast");
        if (toast) {
            // Se c'è un timer attivo (click rapidi), cancellalo per riavviare
            if (toast._timer) clearTimeout(toast._timer);

            // Reset animazione: rimuovi classe, forza reflow, riaggiungi
            toast.classList.remove("show");
            void toast.offsetWidth; 
            toast.classList.add("show");
            
            // Nascondi dopo 3 secondi
            toast._timer = setTimeout(() => {
                toast.classList.remove("show");
            }, 3000);
        }
    };

    // 1. Prova API moderna (HTTPS)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showToast).catch(() => fallbackCopy(text, showToast));
    } else {
        // 2. Fallback per HTTP o browser vecchi
        fallbackCopy(text, showToast);
    }
}

function fallbackCopy(text, onSuccess) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; // Evita scroll pagina
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { if(document.execCommand('copy')) onSuccess(); } catch (e) { console.error(e); }
    document.body.removeChild(textArea);
}