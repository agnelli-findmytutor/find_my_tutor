// 1. CONFIGURAZIONE SUPABASE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';

// 👇 INCOLLA QUI LA TUA CHIAVE ANON LUNGHISSIMA (Quella che inizia con eyJ...)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

// Controllo di sicurezza se la libreria non è caricata
if (typeof supabase === 'undefined') {
    alert("ERRORE GRAVE: La libreria di Supabase non è stata caricata. Controlla dashboard.html");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard caricata, controllo utente...");

    try {
        // 2. RECUPERA UTENTE
        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error) throw error;

        // Se non c'è utente, rimanda al login
        if (!user) {
            console.log("Nessun utente trovato, reindirizzamento...");
            window.location.href = "login.html";
            return;
        }

        console.log("Utente trovato:", user);

        // 3. AGGIORNA INTERFACCIA (RIEMPI I DATI)
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        const userAvatarEl = document.getElementById('userAvatar');

        // Nome (Se non c'è, usa la parte prima della chiocciola della mail)
        const fullName = user.user_metadata.full_name || user.email.split('@')[0];
        userNameEl.textContent = fullName;
        
        // Email
        userEmailEl.textContent = user.email;
        
        // Foto (Se c'è)
        if (user.user_metadata.avatar_url) {
            userAvatarEl.src = user.user_metadata.avatar_url;
        }

    } catch (err) {
        console.error("Errore Dashboard:", err.message);
        document.getElementById('userName').textContent = "Errore di connessione";
        document.getElementById('userEmail').textContent = "Controlla la console (F12)";
    }

    // 4. GESTIONE LOGOUT
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = "index.html";
        });
    }

const deleteBtn = document.getElementById('deleteBtn');
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            // Doppia conferma
            const confirmDelete = confirm("SEI SICURO? Questa azione è irreversibile.");
            
            if (confirmDelete) {
                // Feedback visivo
                const originalText = deleteBtn.innerHTML;
                deleteBtn.innerHTML = 'Cancellazione...';
                deleteBtn.disabled = true;

                try {
                    // ERRORE RISOLTO QUI: Usiamo 'supabaseClient' invece di 'supabase'
                    const { error } = await supabaseClient.rpc('delete_user');

                    if (error) throw error;

                    alert("Account eliminato correttamente.");
                    
                    // Logout e redirect
                    await supabaseClient.auth.signOut();
                    window.location.href = "index.html";

                } catch (err) {
                    console.error("Errore eliminazione:", err);
                    alert("Errore: " + err.message);
                    
                    // Ripristina il bottone
                    deleteBtn.innerHTML = originalText;
                    deleteBtn.disabled = false;
                }
            }
        });
    }
});