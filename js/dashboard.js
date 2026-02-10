document.addEventListener('DOMContentLoaded', async () => {
    const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    // 1. Recupero Profilo e Ruolo
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    const role = profile ? profile.role : 'studente';

    // UI Setup
    document.getElementById('userName').textContent = user.user_metadata.full_name || "Studente";
    document.getElementById('welcomeName').textContent = (user.user_metadata.full_name || "Studente").split(' ')[0];
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userAvatar').src = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
    
    const badge = document.getElementById('profileRoleBadge');
    badge.className = `role-status-dot badge-${role}`;

    // Mostra/Nascondi elementi in base al ruolo
    if (role === 'tutor' || role === 'admin') {
        document.getElementById('btnAgendaTutor').classList.remove('hidden');
        document.getElementById('navPcto').classList.remove('hidden');
        document.getElementById('btnDowngrade').classList.remove('hidden');
        document.getElementById('tutorLessonsSection').classList.remove('hidden');
        document.getElementById('tutorRatingSection').classList.remove('hidden');
        loadTutorData(user.id);
        loadPctoData(user.id);
    }

    // 2. Caricamento Lezioni Studente (Lezioni che frequento)
    async function loadStudentLessons() {
        const container = document.getElementById('studentLessonsList');
        const { data: lessons } = await sb.from('appointments')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'Confermato')
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .limit(3);

        if (lessons && lessons.length > 0) {
            container.innerHTML = '';
            lessons.forEach(l => {
                container.innerHTML += `
                    <div class="mini-lesson-card">
                        <div class="info">
                            <h4>${l.subject}</h4>
                            <p>Tutor: ${l.tutor_name_cache}</p>
                        </div>
                        <div class="time-tag">${l.date.split('-').reverse().join('/')}</div>
                    </div>`;
            });
        }
    }

    // 3. Caricamento Lezioni Tutor (Lezioni che insegno)
    async function loadTutorData(tutorId) {
        const container = document.getElementById('tutorLessonsList');
        const { data: lessons } = await sb.from('appointments')
            .select('*')
            .eq('tutor_id', tutorId)
            .eq('status', 'Confermato')
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .limit(3);

        if (lessons && lessons.length > 0) {
            container.innerHTML = '';
            lessons.forEach(l => {
                container.innerHTML += `
                    <div class="mini-lesson-card" style="border-left: 4px solid #4a148c;">
                        <div class="info">
                            <h4>${l.subject}</h4>
                            <p>Studente: ${l.student_name}</p>
                        </div>
                        <div class="time-tag" style="background: #f3e5f5; color: #4a148c;">${l.time_slot}</div>
                    </div>`;
            });
        }

        // --- CARICAMENTO RECENSIONI REALI ---
        const { data: ratings } = await sb.from('tutor_ratings').select('rating').eq('tutor_id', tutorId);
        
        let avg = 0;
        if (ratings && ratings.length > 0) {
            avg = (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1);
        }

        const starsContainer = document.getElementById('tutorStars');
        starsContainer.innerHTML = '';
        for(let i=0; i<5; i++) {
            starsContainer.innerHTML += i < Math.round(avg) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        }
        document.getElementById('ratingText').textContent = ratings.length > 0 ? `Media: ${avg}/5 (${ratings.length} voti)` : "Nessuna recensione";
    }

    // --- CARICAMENTO E CALCOLO PCTO ---
    async function loadPctoData(tutorId) {
        const today = new Date().toISOString().split('T')[0];
        // Prendiamo solo le lezioni passate e confermate
        const { data: lessons } = await sb.from('appointments')
            .select('duration')
            .eq('tutor_id', tutorId)
            .eq('status', 'Confermato')
            .lt('date', today);

        let totalMinutes = 0;
        if (lessons) {
            lessons.forEach(l => {
                // duration è salvata come "60 min" o "90 min"
                totalMinutes += parseInt(l.duration) || 0;
            });
        }

        const hours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;

        document.getElementById('pctoHours').textContent = hours;
        
        const extraBox = document.getElementById('pctoExtraMinutes');
        if (remainingMinutes > 0) {
            extraBox.classList.remove('hidden');
        } else {
            extraBox.classList.add('hidden');
        }
    }

    // --- GESTIONE NAVIGAZIONE INTERNA (TABS) ---
    window.switchDashboardTab = (tabId) => {
        document.querySelectorAll('.dashboard-tab-content').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        document.getElementById('tab-' + tabId).classList.remove('hidden');
        if(tabId === 'overview') document.getElementById('navDashboard').classList.add('active');
        if(tabId === 'pcto') document.getElementById('navPcto').classList.add('active');
    };

    // Listener Sidebar
    document.getElementById('navDashboard').onclick = (e) => { e.preventDefault(); switchDashboardTab('overview'); };
    document.getElementById('navPcto').onclick = (e) => { e.preventDefault(); switchDashboardTab('pcto'); };

    // 4. Gestione Pulsanti Logout
    document.getElementById('logoutBtn').onclick = async () => {
        await sb.auth.signOut();
        localStorage.clear();
        window.location.href = "index.html";
    };

    // --- GESTIONE DOWNGRADE (NUOVA LOGICA A 2 STEP) ---

    // Apre il primo modale
    document.getElementById('btnDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.remove('hidden');
    };

    // Chiude il primo modale (Annulla Step 1)
    document.getElementById('btnCancelDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.add('hidden');
    };

    // Conferma Step 1 -> Passa a Step 2
    document.getElementById('btnConfirmDowngrade').onclick = () => {
        document.getElementById('downgradeModal').classList.add('hidden');
        document.getElementById('downgradeStep2Modal').classList.remove('hidden');
    };

    // Chiude il secondo modale (Annulla Step 2)
    document.getElementById('btnCancelDowngrade2').onclick = () => {
        document.getElementById('downgradeStep2Modal').classList.add('hidden');
    };

    // Conferma Finale Downgrade (Esegue update su DB)
    document.getElementById('btnFinalConfirmDowngrade').onclick = async () => {
        const { error } = await sb.from('profiles').update({ role: 'studente' }).eq('id', user.id);
        if (!error) {
            document.getElementById('downgradeStep2Modal').classList.add('hidden');
            document.getElementById('successModal').classList.remove('hidden');
            localStorage.setItem('fmt_role', 'studente'); // Aggiorna la cache locale
        } else {
            alert("Errore durante il downgrade: " + error.message);
        }
    };

    // Chiude modale successo e ricarica
    document.getElementById('btnSuccessClose').onclick = () => window.location.reload();

    // --- GESTIONE DELETE ACCOUNT (NUOVA LOGICA MODALE) ---

    // Apre il modale di cancellazione (invece del confirm nativo)
    document.getElementById('deleteBtn').onclick = () => {
        document.getElementById('deleteAccountModal').classList.remove('hidden');
    };

    // Annulla cancellazione (Chiude modale)
    document.getElementById('btnCancelDelete').onclick = () => {
        document.getElementById('deleteAccountModal').classList.add('hidden');
    };

    // Conferma cancellazione (Chiama la funzione)
    document.getElementById('btnConfirmDeleteAccount').onclick = async () => {
        await deleteAccount();
    };

    // Funzione effettiva di cancellazione
    async function deleteAccount() {
        try {
            // Elimina il profilo dal database
            const { error } = await sb.from('profiles').delete().eq('id', user.id);
            
            if (error) throw error;

            // Logout e pulizia
            await sb.auth.signOut();
            localStorage.clear();
            
            alert("Account eliminato correttamente.");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Errore cancellazione:", error);
            alert("Si è verificato un errore durante l'eliminazione dell'account. Riprova.");
            // Chiudi il modale anche in caso di errore per evitare blocco UI
            document.getElementById('deleteAccountModal').classList.add('hidden');
        }
    }

    // Avvio caricamento dati
    loadStudentLessons();
});