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
    
    // Banner Stato
    const statusBanner = document.getElementById('statusBanner');   
    const successBanner = document.getElementById('successBanner'); 
    const rejectedBanner = document.getElementById('rejectedBanner'); 
    const rejectReasonText = document.getElementById('rejectReasonText');
    const btnTryAgain = document.getElementById('btnTryAgain');

    // Modale Feedback
    const modal = document.getElementById('feedbackModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const btnModalClose = document.getElementById('btnModalClose');

    // --- ELEMENTI DISPONIBILITÀ (ORARI) ---
    const btnAddSlot = document.getElementById('btnAddSlot');
    const slotsContainer = document.getElementById('slotsContainer');
    const availHiddenInput = document.getElementById('availability'); // Input nascosto fondamentale
    
    let existingRequestId = null;

    // --- FUNZIONE MODALE ---
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

    // 1. CONTROLLO UTENTE LOGGATO
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

    // 2. CERCA RICHIESTE ESISTENTI (E RIPOPOLA I CAMPI)
    try {
        const { data: request, error } = await sb
            .from('tutor_requests')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (request) {
            existingRequestId = request.id;

            // Nascondi tutti i banner inizialmente
            statusBanner.classList.add('hidden');
            successBanner.classList.add('hidden');
            rejectedBanner.classList.add('hidden');

            if (request.status === 'approved') {
                successBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
            
            } else if (request.status === 'rejected') {
                rejectedBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
                if(rejectReasonText) {
                    rejectReasonText.textContent = request.rejection_reason || "Non specificato.";
                }

            } else if (request.status === 'pending') {
                // --- UTENTE IN ATTESA: MOSTRIAMO I SUOI DATI ---
                document.getElementById('fullName').value = request.full_name;
                document.getElementById('email').value = request.email;
                document.getElementById('phone').value = request.phone;
                document.getElementById('classInfo').value = request.class_info;
                document.getElementById('subjects').value = request.subjects;
                
                // Popola input nascosto
                document.getElementById('availability').value = request.availability;

                // --- VISUALIZZA I BLOCCHETTI ORARI SALVATI ---
                if (request.availability && request.availability.trim() !== "") {
                    const savedSlots = request.availability.split(',');
                    slotsContainer.innerHTML = ''; 
                    savedSlots.forEach(slotText => {
                        createAvailChip(slotText.trim());
                    });
                }

                statusBanner.classList.remove('hidden');
                btnSubmitNew.classList.add('hidden');
                btnGroupExisting.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Errore controllo richieste:", err);
    }

    // --- 3. LOGICA DISPONIBILITÀ (IL CUORE DEL SISTEMA) ---
    
    // Click su "+"
    if(btnAddSlot) {
        btnAddSlot.addEventListener('click', () => {
            const day = document.getElementById('tempDay').value;
            const start = document.getElementById('tempStart').value;
            const end = document.getElementById('tempEnd').value;

            if(!start || !end) { alert("Inserisci orario inizio e fine."); return; }
            if(start >= end) { alert("L'ora di fine deve essere dopo l'inizio."); return; }

            // Crea testo: "Lunedì 14:00-16:00"
            const slotText = `${day} ${start}-${end}`;
            
            // Crea chip visivo
            createAvailChip(slotText);
            
            // Aggiorna input nascosto (PER SALVARE NEL DB)
            updateAvailString();

            // Reset campi
            document.getElementById('tempStart').value = '';
            document.getElementById('tempEnd').value = '';
        });
    }

    // Crea il blocchetto visivo (Con fix grafico X)
    function createAvailChip(text) {
        if(!text) return;
        const chip = document.createElement('div');
        chip.className = 'avail-chip';
        
        chip.style = `
            background: #e1bee7; 
            color: #4a148c; 
            border: 1px solid #ba68c8; 
            padding: 5px 12px; 
            border-radius: 20px; 
            font-size: 0.85rem; 
            display: inline-flex !important; 
            align-items: center !important; 
            gap: 8px !important; 
            font-weight: 600;
            white-space: nowrap;
            position: relative !important;
            margin-bottom: 5px;
            margin-right: 5px;
        `;
        
        chip.innerHTML = `
            <span>${text}</span>
            <i class="fas fa-times" style="
                cursor: pointer; 
                color: #c62828 !important; 
                position: static !important; 
                margin: 0 !important;
                font-size: 1rem !important;
                display: inline-block !important;"></i>
        `;

        // Rimuovi al click sulla X
        chip.querySelector('.fa-times').addEventListener('click', () => {
            chip.remove();
            updateAvailString(); // Aggiorna input nascosto quando rimuovi
        });

        slotsContainer.appendChild(chip);
    }

    // Aggiorna l'input nascosto leggendo tutti i chip
    function updateAvailString() {
        const chips = document.querySelectorAll('#slotsContainer .avail-chip span');
        let parts = [];
        chips.forEach(c => parts.push(c.innerText));
        
        // Unisce tutto in una stringa separata da virgole
        // Es: "Lunedì 14:00-15:00, Martedì 09:00-11:00"
        availHiddenInput.value = parts.join(', ');
    }

    // --- 4. INVIO NUOVA CANDIDATURA ---
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(existingRequestId) return; 

            // CONTROLLO FONDAMENTALE: Verifica che ci siano orari
            const availValue = document.getElementById('availability').value;
            if(!availValue || availValue.trim() === "") {
                alert("Per favore aggiungi almeno una disponibilità oraria col tasto viola +");
                return;
            }

            setLoading(btnSubmitNew, true, 'Invio in corso...');
            const formData = getFormData();
            
            // Aggiungi dati sistema
            formData.user_id = user.id;
            formData.status = 'pending';

            try {
                // Inserimento su Supabase
                const { error } = await sb.from('tutor_requests').insert([formData]);
                if (error) throw error;
                showModal("Candidatura Inviata! 🚀", "Grazie per esserti proposto. Valuteremo la tua richiesta al più presto.");
            } catch (err) {
                alert("Errore: " + err.message);
                setLoading(btnSubmitNew, false, 'Invia Candidatura <i class="fas fa-arrow-right"></i>');
            }
        });
    }

    // --- 5. AGGIORNA CANDIDATURA ESISTENTE ---
    const btnUpdate = document.getElementById('btnUpdate');
    if(btnUpdate) {
        btnUpdate.addEventListener('click', async () => {
            if(!existingRequestId) return;

            const availValue = document.getElementById('availability').value;
            if(!availValue || availValue.trim() === "") {
                alert("Inserisci almeno una disponibilità.");
                return;
            }

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

    // --- 6. ALTRE FUNZIONI (RITIRA, RIPROVA, UTILS) ---
    
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

    if(btnTryAgain) {
        btnTryAgain.addEventListener('click', async () => {
            if(!existingRequestId) return;
            btnTryAgain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparazione...';
            btnTryAgain.disabled = true;
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                window.location.reload(); 
            } catch (err) {
                alert("Errore: " + err.message);
                btnTryAgain.innerHTML = '<i class="fas fa-redo"></i> Riprova e Invia Nuova Candidatura';
                btnTryAgain.disabled = false;
            }
        });
    }

    function getFormData() {
        return {
            full_name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            class_info: document.getElementById('classInfo').value,
            subjects: document.getElementById('subjects').value,
            availability: document.getElementById('availability').value // Prende il valore aggiornato dai chip
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