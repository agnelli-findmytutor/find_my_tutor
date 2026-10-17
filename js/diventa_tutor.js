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

    // Modale Feedback (Successo)
    const modal = document.getElementById('feedbackModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const btnModalClose = document.getElementById('btnModalClose');

    // Modale Alert (Errore / Avviso)
    const alertModal = document.getElementById('alertModal');
    const alertModalTitle = document.getElementById('alertModalTitle');
    const alertModalMessage = document.getElementById('alertModalMessage');
    const btnAlertModalClose = document.getElementById('btnAlertModalClose');

    // --- HELPER MODALI (precedentemente mancanti!) ---
    function showModal(title, message) {
        if (modalTitle) modalTitle.textContent = title || 'Operazione completata';
        if (modalMessage) modalMessage.textContent = message || '';
        if (modal) modal.classList.remove('hidden');
    }

    function showAlert(title, message) {
        if (alertModalTitle) alertModalTitle.textContent = title || 'Attenzione';
        if (alertModalMessage) alertModalMessage.textContent = message || '';
        if (alertModal) alertModal.classList.remove('hidden');
    }

    if (btnModalClose) {
        btnModalClose.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
            window.location.reload();
        });
    }

    if (btnAlertModalClose) {
        btnAlertModalClose.addEventListener('click', () => {
            if (alertModal) alertModal.classList.add('hidden');
        });
    }

    // --- ELEMENTI DISPONIBILITÀ (ORARI) ---
    const btnAddSlot = document.getElementById('btnAddSlot');
    const slotsContainer = document.getElementById('slotsContainer');
    const availHiddenInput = document.getElementById('availability');
    const manualClassSelect = document.getElementById('manualClassSelect');
    const subjectCheckboxesGrid = document.getElementById('subjectCheckboxesGrid');
    const selectedSubjectsCount = document.getElementById('selectedSubjectsCount');

    // Aggiorna l'input nascosto #subjects e il contatore badge quando cambiano le checkbox
    function syncSelectedSubjects() {
        const checked = Array.from(document.querySelectorAll('input[name="subject_checkbox"]:checked'))
                             .map(cb => cb.value);
        const subjectsHidden = document.getElementById('subjects');
        if (subjectsHidden) subjectsHidden.value = checked.join(', ');
        if (selectedSubjectsCount) {
            selectedSubjectsCount.textContent = `${checked.length} ${checked.length === 1 ? 'selezionata' : 'selezionate'}`;
        }
    }

    if (subjectCheckboxesGrid) {
        subjectCheckboxesGrid.addEventListener('change', (e) => {
            if (e.target && e.target.name === 'subject_checkbox') {
                syncSelectedSubjects();
            }
        });
    }

    function renderSubjectListFromClass(classInfo, preSelected = []) {
        const container = document.getElementById('subjectCheckboxesGrid');
        const banner = document.getElementById('classDetectedBanner');
        const classLabel = document.getElementById('classDetectedLabel');
        if (!container) return;

        const cleanClass = classInfo ? classInfo.trim().toUpperCase().replace(/\s+/g, '') : '';

        if (!cleanClass || typeof SubjectsConfig === 'undefined' || !SubjectsConfig.parseClass(cleanClass)) {
            if (banner) banner.style.display = 'none';
            container.innerHTML = '<p style="color:#64748b; font-size:0.88rem; grid-column: 1 / -1; text-align:center; padding: 14px;"><i class="fas fa-hand-point-up" style="color:#D32F2F;"></i> Seleziona la tua classe dal menu qui sopra per visualizzare le materie abilitate.</p>';
            syncSelectedSubjects();
            return;
        }

        const subjects = SubjectsConfig.getSubjectsForTutor(cleanClass);
        if (banner) banner.style.display = 'flex';
        if (classLabel) classLabel.textContent = `${cleanClass} (${SubjectsConfig.getSchoolTypeLabel(cleanClass)})`;
        if (manualClassSelect && manualClassSelect.value !== cleanClass) {
            manualClassSelect.value = cleanClass;
        }

        const classInfoHidden = document.getElementById('classInfo');
        if (classInfoHidden) classInfoHidden.value = cleanClass;

        SubjectsConfig.renderCheckboxGrid(container, subjects, preSelected);
        syncSelectedSubjects();
    }

    if (manualClassSelect) {
        manualClassSelect.addEventListener('change', () => {
            const currentChecked = Array.from(document.querySelectorAll('input[name="subject_checkbox"]:checked')).map(cb => cb.value);
            renderSubjectListFromClass(manualClassSelect.value, currentChecked);
        });
    }

    let existingRequestId = null;

    // 1. CONTROLLO UTENTE LOGGATO (UNIFICATO TRA GOOGLE E MASTERCOM)
    let user = null;
    try {
        const { data } = await sb.auth.getUser();
        user = data?.user || null;
    } catch(e) {}

    let fmtUser = (typeof FMT_API !== 'undefined') ? FMT_API.getCurrentUser() : null;

    if (!user && fmtUser) {
        user = {
            id: fmtUser.google_id || fmtUser.id,
            email: fmtUser.google_email || fmtUser.email,
            user_metadata: {
                full_name: fmtUser.full_name,
                avatar_url: fmtUser.avatar_url
            }
        };
    }

    if (!user) {
        if (mainFormContainer) mainFormContainer.classList.add('hidden');
        if (loginWarning) loginWarning.classList.remove('hidden');
        return; 
    }

    if (mainFormContainer) mainFormContainer.classList.remove('hidden');
    if (loginWarning) loginWarning.classList.add('hidden');

    // Pre-popola Nome ed Email dall'utente loggato
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    if (fullNameInput && !fullNameInput.value) {
        fullNameInput.value = user.user_metadata?.full_name || fmtUser?.full_name || '';
    }
    if (emailInput && !emailInput.value) {
        emailInput.value = user.email || fmtUser?.google_email || fmtUser?.email || '';
    }

    // Recupera class_info dal profilo
    let userClassInfo = fmtUser ? fmtUser.class_info : null;
    if (!userClassInfo && user) {
        try {
            const { data: profile } = await sb.from('profiles').select('class_info').eq('id', user.id).maybeSingle();
            if (profile && profile.class_info) userClassInfo = profile.class_info;
        } catch(e) {}
    }

    renderSubjectListFromClass(userClassInfo);

    // --- FUNZIONI CHIP DISPONIBILITÀ ORARIA ---
    function createAvailChip(text) {
        if (!text || !slotsContainer) return;
        // Evita duplicati esatti
        const existing = Array.from(slotsContainer.querySelectorAll('.avail-chip span')).map(s => s.innerText.trim());
        if (existing.includes(text.trim())) return;

        const chip = document.createElement('div');
        chip.className = 'avail-chip';
        chip.innerHTML = `
            <i class="far fa-calendar-check"></i>
            <span>${text.trim()}</span>
            <i class="fas fa-times" title="Rimuovi fascia oraria"></i>
        `;

        chip.querySelector('.fa-times').addEventListener('click', () => {
            chip.remove();
            updateAvailString();
        });

        slotsContainer.appendChild(chip);
    }

    function updateAvailString() {
        const chips = document.querySelectorAll('#slotsContainer .avail-chip span');
        const parts = Array.from(chips).map(c => c.innerText.trim());
        if (availHiddenInput) availHiddenInput.value = parts.join(', ');
    }

    // 2. CONTROLLO RICHIESTE ESISTENTI
    try {
        const { data: request, error } = await sb
            .from('tutor_requests')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (request) {
            existingRequestId = request.id;

            statusBanner.classList.add('hidden');
            successBanner.classList.add('hidden');
            rejectedBanner.classList.add('hidden');

            if (request.status === 'approved') {
                successBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
            } else if (request.status === 'rejected') {
                rejectedBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
                if (rejectReasonText) {
                    rejectReasonText.textContent = request.rejection_reason || "Non specificato.";
                }
            } else if (request.status === 'pending') {
                document.getElementById('fullName').value = request.full_name || '';
                document.getElementById('email').value = request.email || '';
                document.getElementById('phone').value = request.phone || '';
                
                const classInfoHidden = document.getElementById('classInfo');
                const subjectsHidden = document.getElementById('subjects');
                if (classInfoHidden) classInfoHidden.value = request.class_info || '';
                if (subjectsHidden) subjectsHidden.value = request.subjects || '';
                if (availHiddenInput) availHiddenInput.value = request.availability || '';

                const savedSubjects = request.subjects ? request.subjects.split(',').map(s => s.trim()) : [];
                renderSubjectListFromClass(request.class_info || userClassInfo, savedSubjects);

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

    // --- 3. LOGICA DISPONIBILITÀ ORARIA ---
    function tryAddSlot(day, start, end) {
        if (!start || !end) { 
            showAlert("Campo Mancante", "Inserisci un orario di inizio e uno di fine."); 
            return false; 
        }
        if (start >= end) { 
            showAlert("Orario non valido", "L'orario di fine deve essere successivo a quello di inizio."); 
            return false; 
        }
        
        const getMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const startMin = getMinutes(start);
        const endMin = getMinutes(end);
        const diff = endMin - startMin;

        const [, sM] = start.split(':').map(Number);
        const [, eM] = end.split(':').map(Number);
        if (sM % 15 !== 0 || eM % 15 !== 0) {
            showAlert("Orario non allineato", "Gli orari devono essere a quarti d'ora (es. :00, :15, :30, :45).");
            return false;
        }

        // 14:45 = 885 min, 18:00 = 1080 min
        if (startMin < 885 || endMin > 1080) {
            showAlert("Orario non consentito", "L'orario pomeridiano deve essere compreso tra le 14:45 e le 18:00.");
            return false;
        }

        if (![60, 90, 120, 150, 180].includes(diff)) {
            showAlert("Durata non valida", "La fascia deve avere una durata di 1h, 1h 30m, 2h, 2h 30m o 3h.");
            return false;
        }

        const slotText = `${day} ${start}-${end}`;
        createAvailChip(slotText);
        updateAvailString();
        return true;
    }

    if (btnAddSlot) {
        btnAddSlot.addEventListener('click', () => {
            const day = document.getElementById('tempDay').value;
            const start = document.getElementById('tempStart').value;
            const end = document.getElementById('tempEnd').value;
            tryAddSlot(day, start, end);
        });
    }

    // Bottoni preset orari rapidi
    document.querySelectorAll('.slot-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const start = btn.getAttribute('data-start');
            const end = btn.getAttribute('data-end');
            const day = document.getElementById('tempDay').value;
            const startInput = document.getElementById('tempStart');
            const endInput = document.getElementById('tempEnd');
            if (startInput) startInput.value = start;
            if (endInput) endInput.value = end;
            tryAddSlot(day, start, end);
        });
    });

    // --- 4. INVIO NUOVA CANDIDATURA ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (existingRequestId) return; 

            syncSelectedSubjects();

            const phone = document.getElementById('phone').value;
            if (!phone || phone.trim() === "") {
                showAlert("Dati Mancanti", "Inserisci il tuo numero di telefono per essere ricontattato.");
                return;
            }

            const classValue = document.getElementById('classInfo').value;
            const subjectsValue = document.getElementById('subjects').value;
            if (!classValue || classValue.trim() === "" || !subjectsValue || subjectsValue.trim() === "") {
                showAlert("Competenze Mancanti", "Seleziona la tua classe e almeno una materia che desideri insegnare.");
                return;
            }

            const availValue = document.getElementById('availability').value;
            if (!availValue || availValue.trim() === "") {
                showAlert("Disponibilità Mancante", "Aggiungi almeno una fascia oraria settimanale usando il tasto + Aggiungi.");
                return;
            }

            setLoading(btnSubmitNew, true, 'Invio in corso...');
            const formData = getFormData();
            formData.user_id = user.id;
            formData.status = 'pending';

            try {
                const { error } = await sb.from('tutor_requests').insert([formData]);
                if (error) throw error;
                showModal("Candidatura Inviata! 🚀", "Grazie per esserti proposto come Tutor. Valuteremo la tua richiesta al più presto.");
            } catch (err) {
                showAlert("Errore di Invio", "Si è verificato un problema durante l'invio: " + err.message);
                setLoading(btnSubmitNew, false, '<span>Invia Candidatura</span> <i class="fas fa-paper-plane"></i>');
            }
        });
    }

    // --- 5. AGGIORNA CANDIDATURA ESISTENTE ---
    const btnUpdate = document.getElementById('btnUpdate');
    if (btnUpdate) {
        btnUpdate.addEventListener('click', async () => {
            if (!existingRequestId) return;

            syncSelectedSubjects();

            const classValue = document.getElementById('classInfo').value;
            const subjectsValue = document.getElementById('subjects').value;
            if (!classValue || !subjectsValue) {
                showAlert("Competenze Mancanti", "Seleziona almeno una materia dalla lista.");
                return;
            }

            const availValue = document.getElementById('availability').value;
            if (!availValue || availValue.trim() === "") {
                showAlert("Disponibilità Mancante", "Inserisci almeno una fascia oraria settimanale.");
                return;
            }

            setLoading(btnUpdate, true, 'Salvataggio...');
            try {
                const { error } = await sb.from('tutor_requests').update(getFormData()).eq('id', existingRequestId);
                if (error) throw error;
                showModal("Informazioni Aggiornate", "I dati della tua candidatura sono stati aggiornati con successo.");
            } catch (err) {
                showAlert("Errore di Aggiornamento", "Si è verificato un problema: " + err.message);
                setLoading(btnUpdate, false, '<i class="fas fa-sync-alt"></i> Aggiorna Informazioni');
            }
        });
    }

    // --- 6. RITIRA / RIPROVA ---
    const btnWithdraw = document.getElementById('btnWithdraw');
    if (btnWithdraw) {
        btnWithdraw.addEventListener('click', async () => {
            if (!existingRequestId || !confirm("Sei sicuro di voler ritirare la tua candidatura?")) return;
            setLoading(btnWithdraw, true, '...');
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                showModal("Candidatura Ritirata", "La tua richiesta è stata cancellata.");
            } catch (err) {
                showAlert("Errore", "Impossibile ritirare la candidatura: " + err.message);
                setLoading(btnWithdraw, false, '<i class="fas fa-trash-alt"></i> Ritira Candidatura');
            }
        });
    }

    if (btnTryAgain) {
        btnTryAgain.addEventListener('click', async () => {
            if (!existingRequestId) return;
            btnTryAgain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparazione...';
            btnTryAgain.disabled = true;
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                window.location.reload(); 
            } catch (err) {
                showAlert("Errore", "Si è verificato un problema: " + err.message);
                btnTryAgain.innerHTML = '<i class="fas fa-redo"></i> Compila Nuova Candidatura';
                btnTryAgain.disabled = false;
            }
        });
    }

    function getFormData() {
        syncSelectedSubjects();
        return {
            full_name: user.user_metadata?.full_name || document.getElementById('fullName').value,
            email: user.email || document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            class_info: document.getElementById('classInfo').value,
            subjects: document.getElementById('subjects').value,
            availability: document.getElementById('availability').value
        };
    }

    function setLoading(btn, isLoading, text) {
        if (!btn) return;
        if (isLoading) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
            btn.disabled = true;
            btn.style.opacity = "0.75";
        } else {
            btn.innerHTML = text;
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
});
