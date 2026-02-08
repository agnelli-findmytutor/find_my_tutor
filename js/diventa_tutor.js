// CONFIGURAZIONE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- ELEMENTI DOM ---
    const loginWarning = document.getElementById('loginWarning');
    const mainFormContainer = document.getElementById('mainFormContainer');
    
    const form = document.getElementById('tutorForm');
    const formContent = document.getElementById('formContent');
    const btnSubmitNew = document.getElementById('btnSubmitNew');
    const btnGroupExisting = document.getElementById('btnGroupExisting');
    
    // Banner
    const statusBanner = document.getElementById('statusBanner');   // Giallo (Pending)
    const successBanner = document.getElementById('successBanner'); // Verde (Approved)
    const rejectedBanner = document.getElementById('rejectedBanner'); // Rosso (Rejected)
    const rejectReasonText = document.getElementById('rejectReasonText');
    const btnTryAgain = document.getElementById('btnTryAgain');

    // Modale Feedback
    const modal = document.getElementById('feedbackModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const btnModalClose = document.getElementById('btnModalClose');
    
    let existingRequestId = null;

    // --- FUNZIONE PER MOSTRARE IL MODALE ---
    function showModal(title, msg) {
        if(modalTitle) modalTitle.textContent = title;
        if(modalMessage) modalMessage.textContent = msg;
        if(modal) modal.classList.remove('hidden');
    }

    if (btnModalClose) {
        btnModalClose.addEventListener('click', () => {
            if(modal) modal.classList.add('hidden');
            window.location.reload();
        });
    }

    // 1. CONTROLLO UTENTE
    const { data: { user } } = await sb.auth.getUser();

    if (!user) {
        if(mainFormContainer) mainFormContainer.classList.add('hidden');
        if(loginWarning) loginWarning.classList.remove('hidden');
        return; 
    }

    if(mainFormContainer) mainFormContainer.classList.remove('hidden');
    if(loginWarning) loginWarning.classList.add('hidden');

    const emailInput = document.getElementById('email');
    if(emailInput && !emailInput.value) emailInput.value = user.email;

    // 2. CERCA RICHIESTE ESISTENTI
    try {
        const { data: request, error } = await sb
            .from('tutor_requests')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (request) {
            existingRequestId = request.id;

            // Nascondi tutti i banner prima di decidere quale mostrare
            statusBanner.classList.add('hidden');
            successBanner.classList.add('hidden');
            rejectedBanner.classList.add('hidden');

            if (request.status === 'approved') {
                // --- APPROVATO ---
                successBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
            
            } else if (request.status === 'rejected') {
                // --- RIFIUTATO ---
                rejectedBanner.classList.remove('hidden');
                formContent.classList.add('hidden'); // Nasconde il form
                
                // Mostra il motivo
                if(rejectReasonText) {
                    rejectReasonText.textContent = request.rejection_reason || "Non specificato.";
                }

            } else if (request.status === 'pending') {
                // --- IN ATTESA ---
                // Precompila i campi
                document.getElementById('fullName').value = request.full_name;
                document.getElementById('email').value = request.email;
                document.getElementById('phone').value = request.phone;
                document.getElementById('classInfo').value = request.class_info;
                document.getElementById('subjects').value = request.subjects;
                document.getElementById('availability').value = request.availability;

                statusBanner.classList.remove('hidden');
                btnSubmitNew.classList.add('hidden');
                btnGroupExisting.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Errore controllo richieste:", err);
    }

    // 3. GESTIONE INVIO (Nuova)
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(existingRequestId) return; 

            setLoading(btnSubmitNew, true, 'Invio in corso...');
            const formData = getFormData();
            formData.user_id = user.id;
            formData.status = 'pending';

            try {
                const { error } = await sb.from('tutor_requests').insert([formData]);
                if (error) throw error;
                showModal("Candidatura Inviata! 🚀", "Grazie per esserti proposto. Valuteremo la tua richiesta al più presto.");
            } catch (err) {
                alert("Errore: " + err.message);
                setLoading(btnSubmitNew, false, 'Invia Candidatura <i class="fas fa-arrow-right"></i>');
            }
        });
    }

    // 4. AGGIORNA
    const btnUpdate = document.getElementById('btnUpdate');
    if(btnUpdate) {
        btnUpdate.addEventListener('click', async () => {
            if(!existingRequestId) return;
            setLoading(btnUpdate, true, 'Salvataggio...');
            try {
                const { error } = await sb.from('tutor_requests').update(getFormData()).eq('id', existingRequestId);
                if (error) throw error;
                showModal("Informazioni Aggiornate", "I dati sono stati modificati con successo.");
            } catch (err) {
                alert("Errore: " + err.message);
                setLoading(btnUpdate, false, '<i class="fas fa-sync-alt"></i> Aggiorna');
            }
        });
    }

    // 5. RITIRA
    const btnWithdraw = document.getElementById('btnWithdraw');
    if(btnWithdraw) {
        btnWithdraw.addEventListener('click', async () => {
            if(!existingRequestId || !confirm("Sei sicuro di voler ritirare la tua candidatura?")) return;
            setLoading(btnWithdraw, true, '...');
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                showModal("Candidatura Ritirata", "La tua richiesta è stata cancellata.");
            } catch (err) {
                alert("Errore: " + err.message);
                setLoading(btnWithdraw, false, '<i class="fas fa-trash-alt"></i> Ritira');
            }
        });
    }

    // 6. RIPROVA (DOPO RIFIUTO)
    if(btnTryAgain) {
        btnTryAgain.addEventListener('click', async () => {
            if(!existingRequestId) return;
            
            // Per riprovare, cancelliamo la vecchia richiesta rifiutata
            // Così l'utente può compilare il form da zero
            btnTryAgain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparazione...';
            btnTryAgain.disabled = true;

            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                
                // Ricarica la pagina: non trovando più la richiesta, mostrerà il form vuoto
                window.location.reload(); 
            } catch (err) {
                alert("Errore: " + err.message);
                btnTryAgain.innerHTML = '<i class="fas fa-redo"></i> Riprova e Invia Nuova Candidatura';
                btnTryAgain.disabled = false;
            }
        });
    }

    // Helper Functions
    function getFormData() {
        return {
            full_name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            class_info: document.getElementById('classInfo').value,
            subjects: document.getElementById('subjects').value,
            availability: document.getElementById('availability').value
        };
    }

    function setLoading(btn, isLoading, text) {
        if(isLoading) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
            btn.disabled = true;
            btn.style.opacity = "0.7";
        } else {
            btn.innerHTML = text;
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
});