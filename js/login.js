document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GESTIONE ANIMAZIONE SLIDER (PRIORITÀ ALTA) ---
    // Definiamo subito l'animazione così funziona sempre
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const container = document.getElementById('container');

    // Se gli elementi esistono, attacchiamo l'evento click
    if (signUpButton && signInButton && container) {
        signUpButton.addEventListener('click', () => {
            container.classList.add("right-panel-active");
        });

        signInButton.addEventListener('click', () => {
            container.classList.remove("right-panel-active");
        });
    } else {
        console.error("Errore: Impossibile trovare i pulsanti per l'animazione (signUp/signIn)");
    }

    // --- 2. CONFIGURAZIONE SUPABASE ---
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    // 👇 INCOLLA QUI SOTTO LA TUA CHIAVE "ANON"
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

    let supabase;

    try {
        // Proviamo a inizializzare Supabase
        if (typeof supabase === 'undefined' && typeof createClient === 'undefined' && !window.supabase) {
            // Se la libreria non è caricata nell'HTML, usiamo un oggetto finto per non rompere tutto
            console.warn("ATTENZIONE: Libreria Supabase non trovata nell'HTML! Il login non funzionerà, ma l'animazione sì.");
        } else {
            // Inizializza correttamente
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
    } catch (err) {
        console.error("Errore inizializzazione Supabase:", err);
    }

// --- 3. GESTIONE LOGIN GOOGLE (AGGIORNATA) ---
    const loginWithGoogle = async () => {
        if (!supabase) {
            alert("Errore tecnico: Libreria Supabase mancante.");
            return;
        }

        // CALCOLA L'URL DI REINDIRIZZAMENTO CORRETTO
        // Se siamo in locale (127.0.0.1 o localhost), usa l'origin semplice.
        // Se siamo online, FORZA l'URL completo di GitHub Pages (fondamentale per evitare errore 400).
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        
        const redirectUrl = isLocal 
            ? window.location.origin + '/index.html' // Esempio: http://127.0.0.1:5500/index.html
            : 'https://agnelli-findmytutor.github.io/find_my_tutor/index.html'; // URL ESATTO GITHUB

        console.log("Tentativo di login. Redirect verso:", redirectUrl);

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        prompt: 'select_account', // Forza la scelta dell'account
                    }
                }
            });

            if (error) throw error;
            
        } catch (error) {
            console.error("Errore login:", error.message);
            alert("Errore login: " + error.message);
            window.location.reload(); // Ricarica la pagina per resettare i pulsanti
        }
    };

    // --- 4. CLICK SUI PULSANTI GOOGLE ---
    const googleBtns = document.querySelectorAll('.google-btn');
    
    googleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Effetto caricamento
            const btnText = btn.querySelector('.btn-text');
            if(btnText) btnText.innerText = "Reindirizzamento...";
            btn.style.opacity = "0.7";
            btn.style.pointerEvents = "none"; // Evita doppi click
            
            // Avvia Login
            loginWithGoogle();
        });
    });

});