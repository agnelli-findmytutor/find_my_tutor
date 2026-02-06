document.addEventListener('DOMContentLoaded', () => {
    
    // 1. GESTIONE SCROLL REVEAL (Animazione elementi che appaiono)
    const observerOptions = {
        threshold: 0.15, // L'elemento deve essere visibile al 15%
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Se è una statistica, avvia il contatore
                if (entry.target.classList.contains('stats')) {
                    startCounters();
                }
                observer.unobserve(entry.target); // Anima solo una volta
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });

    // 2. MENU MOBILE
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const header = document.querySelector('header');

    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // Stile semplice per il menu mobile quando attivo
        if (navLinks.classList.contains('active')) {
            navLinks.style.display = 'flex';
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '100%';
            navLinks.style.left = '0';
            navLinks.style.width = '100%';
            navLinks.style.background = 'white';
            navLinks.style.padding = '2rem';
            navLinks.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
            navLinks.style.textAlign = 'center';
        } else {
            navLinks.style.display = ''; // Reset allo stile CSS originale
        }
    });

    // 3. EFFETTO HEADER SCROLL (Cambia ombra quando scorri)
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = "0 5px 20px rgba(0,0,0,0.1)";
        } else {
            header.style.boxShadow = "0 2px 15px rgba(0,0,0,0.03)";
        }
    });

    // 4. ANIMAZIONE NUMERI (Stats)
    function startCounters() {
        const counters = document.querySelectorAll('.counter');
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const increment = target / 50; // Velocità
            
            const updateCounter = () => {
                const c = +counter.innerText.replace('+', '');
                if (c < target) {
                    counter.innerText = Math.ceil(c + increment) + "+";
                    setTimeout(updateCounter, 30);
                } else {
                    counter.innerText = target + "+";
                }
            };
            updateCounter();
        });
    }
    // CODICE JAVASCRIPT PER IL CAROSELLO DA AGGIUNGERE A script.js

// 5. GESTIONE CAROSELLO
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
const indicators = document.querySelectorAll('.indicator');
const totalSlides = slides.length;

function showSlide(index) {
    // Gestisci i limiti dell'indice
    if (index >= totalSlides) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide = totalSlides - 1;
    } else {
        currentSlide = index;
    }

    // Rimuovi la classe active da tutte le slide e indicatori
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));

    // Aggiungi la classe active alla slide e all'indicatore correnti
    slides[currentSlide].classList.add('active');
    indicators[currentSlide].classList.add('active');
}

// Event Listener per i controlli (frecce)
document.querySelector('.carousel-control.next').addEventListener('click', () => {
    showSlide(currentSlide + 1);
});

document.querySelector('.carousel-control.prev').addEventListener('click', () => {
    showSlide(currentSlide - 1);
});

// Event Listener per gli indicatori (punti)
indicators.forEach(indicator => {
    indicator.addEventListener('click', (e) => {
        const slideIndex = parseInt(e.target.getAttribute('data-slide'));
        showSlide(slideIndex);
    });
});

// AGGIUNGI QUESTO DENTRO document.addEventListener('DOMContentLoaded', ...)

// 6. GESTIONE PULSANTE "SCROLL TO TOP"
const scrollToTopBtn = document.getElementById("scrollToTop");

window.addEventListener("scroll", () => {
    // Mostra il pulsante se scorri più di 300px
    if (window.scrollY > 300) {
        scrollToTopBtn.classList.add("visible");
    } else {
        scrollToTopBtn.classList.remove("visible");
    }
});

scrollToTopBtn.addEventListener("click", () => {
    // Scroll fluido verso l'alto
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});
});