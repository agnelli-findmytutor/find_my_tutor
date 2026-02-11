(function() {
    // Configurazione Supabase (Deve corrispondere a quella del sito)
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

    // Evita il controllo se siamo già nelle pagine permesse
    const path = window.location.pathname;
    if (path.includes('manutenzione.html') || path.includes('login.html')) {
        return;
    }

    // Inizializza client leggero solo per questo controllo
    // (Assumiamo che supabase.js sia caricato nell'head)
    async function checkMaintenance() {
        // Attendi che Supabase sia caricato
        if (typeof supabase === 'undefined' && window.supabase) {
            supabase = window.supabase;
        }
        if (typeof supabase === 'undefined') {
            console.warn("Global Maintenance: Supabase SDK non trovato.");
            return;
        }

        const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        try {
            // 1. Controlla lo stato della manutenzione
            const { data: setting, error } = await sb
                .from('system_settings')
                .select('value')
                .eq('key', 'maintenance_mode')
                .maybeSingle(); // Usa maybeSingle per evitare errori 406 se la riga non esiste

            if (error) {
                console.error("Errore lettura manutenzione:", error);
                return;
            }
            
            // Se non c'è il setting o è false, tutto ok
            if (!setting || setting.value !== true) return;

            // Se la manutenzione è ATTIVA (value = true)
            console.log("🔒 MANUTENZIONE ATTIVA - Controllo permessi...");

            // Nascondi il sito preventivamente
            document.body.style.display = 'none';
                
            // 2. Controlla chi è l'utente
            const { data: { user } } = await sb.auth.getUser();

            if (!user) {
                // Utente non loggato -> Redirect immediato
                window.location.replace('manutenzione.html');
                return;
            }

            // 3. Se loggato, controlla se è ADMIN
            const { data: profile } = await sb
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (!profile || profile.role !== 'admin') {
                // Utente loggato ma NON admin -> Redirect
                window.location.replace('manutenzione.html');
            }
            else {
                // SE SEI ADMIN: Mostra di nuovo il sito e il banner
                document.body.style.display = '';
                showAdminBanner();
            }
            
        } catch (err) {
            console.error("Errore controllo manutenzione:", err);
            document.body.style.display = ''; // In caso di errore grave, mostra il sito
        }
    }

    function showAdminBanner() {
        if(document.getElementById('maint-admin-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'maint-admin-banner';
        banner.style.cssText = "position:fixed; bottom:20px; right:20px; background:#D32F2F; color:white; padding:12px 20px; border-radius:50px; z-index:999999; font-family:sans-serif; font-size:0.9rem; box-shadow:0 5px 15px rgba(0,0,0,0.3); display:flex; align-items:center; gap:10px;";
        banner.innerHTML = '<i class="fas fa-tools"></i> <strong>Manutenzione ATTIVA</strong> (Tu sei Admin)';
        document.body.appendChild(banner);
    }

    // Esegui il controllo al caricamento
    document.addEventListener('DOMContentLoaded', checkMaintenance);
})();
