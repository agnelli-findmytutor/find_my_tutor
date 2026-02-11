// ============================================================
// 🚨 ULTIMATE SECURITY MONITOR v2 (Threatening Edition)
// Intercetta TUTTE le risposte dal server con stile minaccioso
// ============================================================
(function() {
    
    // 1. Definiamo il Modale "MINACCIOSO"
    function showSecurityLockdown(errorMsg) {
        if (document.getElementById('security-lockdown')) return;

        console.clear(); 
        
        const modal = document.createElement('div');
        modal.id = 'security-lockdown';
        // Stile per lo sfondo: Nero, con bagliore rosso ai bordi e righe tipo vecchio monitor (scanlines)
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background-color: #000;
            background-image: repeating-linear-gradient(0deg, rgba(255,0,0,0.05) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px);
            box-shadow: inset 0 0 150px #500;
            z-index: 2147483647;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            font-family: 'Courier New', Courier, monospace; /* Font monospaziato */
            text-transform: uppercase;
            user-select: none; /* Impedisce di selezionare il testo */
            cursor: not-allowed;
        `;
        
        // Costruiamo l'HTML interno
        modal.innerHTML = `
            <div style="
                border: 4px solid red;
                padding: 40px;
                background: rgba(20, 0, 0, 0.9);
                box-shadow: 0 0 50px red, inset 0 0 20px red;
                text-align: center;
                max-width: 90%;
                animation: pulseBorder 2s infinite;
            ">
                 <div style="font-size: 6rem; color: red; margin-bottom: 20px; text-shadow: 0 0 20px red;">
                    <span style="display:inline-block; transform: scale(1.5);">⊘</span>
                </div>

                <h1 style="
                    font-size: 3.5rem; margin: 0; color: #ff0000; 
                    text-shadow: 0 0 10px red, 0 0 30px red, 0 0 50px red;
                    letter-spacing: 4px; font-weight: 900;
                ">VIOLAZIONE DI SICUREZZA</h1>
                
                <h2 style="font-size: 1.5rem; color: #ffcccc; margin-top: 20px; letter-spacing: 2px;">
                    PROTOCOLLO DI DIFESA ATTIVO, PORCO DIO MARCO GODO PROVA ANCORA A VIOLARE IL PORCODIO DI SITO.
                </h2>
                <p style="color: red; font-size: 1.2rem;">IL TUO INDIRIZZO IP E' STATO REGISTRATO E SEGNALATO.</p>
                
                <div style="margin-top: 40px; border-top: 2px dashed red; border-bottom: 2px dashed red; padding: 20px; background: #0a0000; text-align: left;">
                    <p style="font-size: 1rem; margin: 5px 0; color: #ff3333;">> SYSTEM_ALERT: Intrusion attempt detected.</p>
                    <p style="font-size: 1rem; margin: 5px 0; color: #ff3333;">> ERROR_CODE: [ <strong style="color: white;">${errorMsg.code || 'UNKNOWN'}</strong> ]</p>
                    <p style="font-size: 1rem; margin: 5px 0; color: #ff3333;">> PAYLOAD_MESSAGE: "${errorMsg.message || 'Unauthorized DB Access'}"</p>
                    <p style="font-size: 1rem; margin: 5px 0; color: red; animation: blink 1s infinite;">> STATUS: LOCKDOWN INITIATED_</p>
                </div>
            </div>

            <button onclick="location.reload()" style="
                margin-top: 60px; padding: 15px 40px; font-size: 1.2rem; 
                background: #b71c1c; color: black; border: none; font-weight: 900; 
                cursor: pointer; text-transform: uppercase; letter-spacing: 2px;
                box-shadow: 0 0 20px red; transition: 0.3s;
                font-family: 'Courier New', monospace;
            " onmouseover="this.style.background='red';this.style.color='white'" onmouseout="this.style.background='#b71c1c';this.style.color='black'">
                [ SONO FORCIO (MI ARRENDO) ]
            </button>

            <style>
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                @keyframes pulseBorder { 0% { box-shadow: 0 0 30px red, inset 0 0 10px red; } 50% { box-shadow: 0 0 60px red, inset 0 0 30px red; } 100% { box-shadow: 0 0 30px red, inset 0 0 10px red; } }
            </style>
        `;

        document.body.appendChild(modal);
        
        // Tentativo di riprodurre un suono di errore grave (basso e distorto)
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'square'; // Suono più aspro
            osc.frequency.setValueAtTime(100, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.5);
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
            osc.start(); osc.stop(audioCtx.currentTime + 1.5);
        } catch(e) {}
    }

    // 2. OVERRIDE DEL FETCH (Resta invariato, è il motore che funziona)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const clone = response.clone();
        try {
            if (!response.ok) {
                const body = await clone.json();
                if (body && (body.code === 'P0001' || body.code === '42501')) {
                    showSecurityLockdown(body);
                    return new Promise(() => {}); 
                }
            }
        } catch (err) {}
        return response;
    };

    console.log("%cSYSTEM INTEGRITY MONITOR: ACTIVE", "color: red; background: black; font-weight: bold;");
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