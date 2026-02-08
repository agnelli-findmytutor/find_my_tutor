// 1. CONFIGURAZIONE SUPABASE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

if (typeof supabase === 'undefined') {
    alert("ERRORE: Libreria Supabase non caricata.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    
    try {
        // 2. RECUPERA UTENTE
        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error || !user) {
            window.location.href = "login.html";
            return;
        }

        // 3. RECUPERA RUOLO
        let userRole = 'studente';
        try {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            if (profile && profile.role) userRole = profile.role;
        } catch (e) {
            if (user.user_metadata.role) userRole = user.user_metadata.role;
        }

        // 4. ELEMENTI HTML
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');
        const avatarEl = document.getElementById('userAvatar');
        const badgeEl = document.getElementById('profileRoleBadge');
        
        const btnAgenda = document.getElementById('btnAgendaTutor');
        const btnDowngrade = document.getElementById('btnDowngrade');
        
        // MODALI
        const modalConfirm = document.getElementById('downgradeModal');
        const modalSuccess = document.getElementById('successModal'); // NUOVO

        const btnCancelModal = document.getElementById('btnCancelDowngrade');
        const btnConfirmModal = document.getElementById('btnConfirmDowngrade');
        const btnSuccessClose = document.getElementById('btnSuccessClose'); // NUOVO

        // 5. RIEMPI DATI
        const fullName = user.user_metadata.full_name || user.email.split('@')[0];
        if(nameEl) nameEl.textContent = fullName;
        if(emailEl) emailEl.textContent = user.email;
        if(avatarEl && user.user_metadata.avatar_url) avatarEl.src = user.user_metadata.avatar_url;

        // 6. GESTIONE RUOLI UI
        if (badgeEl) {
            if (userRole === 'admin') {
                badgeEl.innerText = "AMMINISTRATORE";
                badgeEl.className = "role-badge badge-admin";
                if(btnAgenda) btnAgenda.classList.remove('hidden');

            } else if (userRole === 'tutor') {
                badgeEl.innerText = "STUDENTE TUTOR";
                badgeEl.className = "role-badge badge-tutor"; 
                if(btnAgenda) btnAgenda.classList.remove('hidden');
                if(btnDowngrade) btnDowngrade.classList.remove('hidden');

            } else {
                badgeEl.innerText = "STUDENTE";
                badgeEl.className = "role-badge badge-student"; 
                if(btnAgenda) btnAgenda.classList.add('hidden');
                if(btnDowngrade) btnDowngrade.classList.add('hidden');
            }
        }

        // 7. EVENTI MODALI

        // APRI MODALE CONFERMA
        if (btnDowngrade) {
            btnDowngrade.addEventListener('click', () => {
                if(modalConfirm) modalConfirm.classList.remove('hidden');
            });
        }

        // CHIUDI MODALE CONFERMA
        if (btnCancelModal) {
            btnCancelModal.addEventListener('click', () => {
                if(modalConfirm) modalConfirm.classList.add('hidden');
            });
        }

        // AZIONE CONFERMA (E APERTURA SUCCESSO)
        if (btnConfirmModal) {
            btnConfirmModal.addEventListener('click', async () => {
                const originalText = btnConfirmModal.innerHTML;
                btnConfirmModal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attendi...';
                btnConfirmModal.disabled = true;

                try {
                    // 1. Cancella candidatura
                    await supabaseClient.from('tutor_requests').delete().eq('user_id', user.id);

                    // 2. Aggiorna ruolo
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({ role: 'studente' })
                        .eq('id', user.id);

                    if (error) throw error;

                    // --- SUCCESSO ---
                    // Chiudi modale conferma
                    if(modalConfirm) modalConfirm.classList.add('hidden');
                    
                    // Apri modale successo (Verde)
                    if(modalSuccess) modalSuccess.classList.remove('hidden');

                } catch (err) {
                    alert("Errore: " + err.message);
                    btnConfirmModal.innerHTML = originalText;
                    btnConfirmModal.disabled = false;
                    if(modalConfirm) modalConfirm.classList.add('hidden');
                }
            });
        }

        // CHIUDI MODALE SUCCESSO (E RICARICA PAGINA)
        if (btnSuccessClose) {
            btnSuccessClose.addEventListener('click', () => {
                window.location.reload();
            });
        }

    } catch (err) {
        console.error("Errore Dashboard:", err);
    }

    // LOGOUT & DELETE ACCOUNT... (Resto del codice invariato)
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
            if (confirm("SEI SICURO?")) { /* ... logica delete ... */ }
        });
    }
});