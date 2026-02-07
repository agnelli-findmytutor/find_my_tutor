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


    // --- 3. GESTIONE LOGIN GOOGLE ---
    const loginWithGoogle = async () => {
        if (!supabase) {
            alert("Errore tecnico: Libreria Supabase mancante.");
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/index.html',
                    queryParams: { prompt: 'select_account' }
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Errore login:", error.message);
            alert("Errore login: " + error.message);
            window.location.reload(); // Ricarica in caso di errore
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
            btn.style.pointerEvents = "none";
            
            // Avvia Login
            loginWithGoogle();
        });
    });

});