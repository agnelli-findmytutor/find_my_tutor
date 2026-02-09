// CONFIGURAZIONE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mappa giorni
const DAY_MAP = {
    'domenica': 0, 'lunedì': 1, 'martedì': 2, 'mercoledì': 3, 
    'giovedì': 4, 'venerdì': 5, 'sabato': 6
};

// Variabili Globali
let allTutors = []; 
let currentLessons = []; 
let idToModify = null; // ID della lezione selezionata
let currentTutorAvailability = []; 

document.addEventListener('DOMContentLoaded', async () => {

    // --- ELEMENTI DOM ---
    const filterYear = document.getElementById('filterYear');
    const filterSubject = document.getElementById('filterSubject');
    const selectTutor = document.getElementById('selectTutor');
    const bookingForm = document.getElementById('bookingForm');
    const myLessonsList = document.getElementById('myLessonsList');

    // Inputs Prenotazione
    const dateInput = document.getElementById('selectDate');
    const timeSelect = document.getElementById('selectTime');
    const availDisplay = document.getElementById('tutorAvailDisplay');
    const availText = document.getElementById('availText');
    const dateError = document.getElementById('dateError');

    // Modali
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const successModal = document.getElementById('successModal');
    const warningModal = document.getElementById('warningModal');

    // --- 1. CHECK UTENTE ---
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    // --- FUNZIONI UTILI ---
    
    function getTutorEmail(tid) {
        const t = allTutors.find(x => x.id === tid);
        return t && t.email ? t.email : 'segreteria@istitutoagnelli.it';
    }

    // Controllo 24h
    function check24Hours(dateString, timeString) {
        try {
            const now = new Date();
            const startTime = timeString.split('-')[0].trim();
            const lessonDate = new Date(`${dateString}T${startTime}`);
            const diffMs = lessonDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);
            return diffHours >= 24;
        } catch (e) {
            console.error("Errore data", e);
            return true; 
        }
    }

    function showWarning(msg) {
        const wMsg = document.getElementById('warningMessage');
        if(wMsg) wMsg.innerHTML = msg;
        if(warningModal) warningModal.classList.remove('hidden');
    }

    function showSuccess(title, msg) {
        const sTitle = document.getElementById('successTitle');
        const sMsg = document.getElementById('successMessage');
        if(sTitle) sTitle.textContent = title;
        if(sMsg) sMsg.textContent = msg;
        if(successModal) successModal.classList.remove('hidden');
    }

    function closeModal(modal) { 
        if(modal) modal.classList.add('hidden'); 
    }

    // --- 2. GESTIONE CLICK SULLA LISTA (EVENT DELEGATION) ---
    // Intercetta i click sui pulsanti generati dinamicamente
    
    myLessonsList.addEventListener('click', (e) => {
        // Cerca se è stato cliccato un bottone MODIFICA (o l'icona dentro)
        const btnEdit = e.target.closest('.btn-action-edit');
        if (btnEdit) {
            const id = btnEdit.getAttribute('data-id');
            openEditModal(id);
            return;
        }

        // Cerca se è stato cliccato un bottone ANNULLA (o l'icona dentro)
        const btnDelete = e.target.closest('.btn-action-delete');
        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            openDeleteModal(id);
            return;
        }
    });

    // --- LOGICA APERTURA MODALI ---

    function openEditModal(id) {
        // Usa == invece di === per permettere confronto stringa/numero
        const lesson = currentLessons.find(l => l.id == id);
        if(!lesson) return;

        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`<strong>Modifica bloccata.</strong><br>Mancano meno di 24 ore.<br>Contatta: ${email}`);
            return;
        }

        idToModify = id;
        
        // Popola il form
        document.getElementById('editLessonId').value = lesson.id;
        document.getElementById('editDate').value = lesson.date;
        document.getElementById('editTime').value = lesson.time_slot;
        document.getElementById('editNotes').value = lesson.notes || '';
        
        // Gestione durata
        let dur = lesson.duration || '60';
        dur = dur.replace(' min', '').trim(); // Pulisce "60 min" -> "60"
        document.getElementById('editDuration').value = dur + " min"; // Rimette "60 min" per combaciare con la select

        // Gestione materia
        const subjInput = document.getElementById('editSubject');
        if(subjInput) subjInput.value = lesson.subject || '';

        editModal.classList.remove('hidden');
    }

    function openDeleteModal(id) {
        const lesson = currentLessons.find(l => l.id == id); // Usa ==
        if(!lesson) return;

        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`<strong>Impossibile annullare.</strong><br>Mancano meno di 24 ore.<br>Scrivi a: ${email}`);
            return;
        }

        idToModify = id;
        deleteModal.classList.remove('hidden');
    }

    // --- 3. CARICAMENTO DATI ---

    async function loadTutors() {
        try {
            const { data } = await sbClient.from('profiles').select('*').eq('role', 'tutor');
            allTutors = data || [];
        } catch(e) { console.error(e); }
    }
    await loadTutors();

    async function fetchLessons() {
        myLessonsList.innerHTML = '<p style="text-align:center">Caricamento...</p>';
        try {
            const { data } = await sbClient.from('appointments').select('*').eq('user_id', user.id).order('date', {ascending:true});
            currentLessons = data || [];
            myLessonsList.innerHTML = '';
            
            if(currentLessons.length === 0) {
                myLessonsList.innerHTML = '<div class="empty-state"><p>Nessuna lezione prenotata.</p></div>';
                return;
            }

            currentLessons.forEach(l => {
                const d = new Date(l.date).toLocaleDateString('it-IT');
                const isCancelled = l.status === 'Cancellata';
                
                let roomInfo = '';
                if (!isCancelled) {
                    roomInfo = l.room_name 
                    ? `<div class="lesson-detail" style="color:#1565c0; font-weight:600; margin-top:5px;"><i class="fas fa-map-marker-alt"></i> Aula: ${l.room_name}</div>`
                    : `<div class="lesson-detail" style="color:#999; font-style:italic; margin-top:5px;"><i class="fas fa-door-closed"></i> Aula da definire</div>`;
                }

                const cancelReasonDisplay = isCancelled
                    ? `<div style="margin-top:10px; background:white; padding:10px; border-radius:8px; border-left:4px solid #d32f2f; color:#c62828;">
                         <strong><i class="fas fa-ban"></i> Cancellata dal Tutor:</strong><br>
                         <span style="font-style:italic;">"${l.cancellation_reason || 'Nessun motivo specificato'}"</span>
                       </div>`
                    : '';

                // NOTA: Qui usiamo classi "btn-action-edit" e attributi data-id invece di onclick
                const buttonsDisplay = isCancelled 
                    ? `<div style="text-align:right; font-size:0.8rem; color:#d32f2f; font-weight:bold; margin-top:10px;">Lezione Annullata</div>`
                    : `<div class="lesson-actions">
                        <button class="btn-mini edit btn-action-edit" data-id="${l.id}"><i class="fas fa-pen"></i> Modifica</button>
                        <button class="btn-mini delete btn-action-delete" data-id="${l.id}"><i class="fas fa-trash"></i> Annulla</button>
                       </div>`;

                const item = document.createElement('div');
                item.className = 'lesson-item';
                if(isCancelled) item.style.cssText = "border-left: 4px solid #d32f2f; background: #fff5f5;";

                item.innerHTML = `
                    <div style="flex:1">
                        <div class="lesson-header">
                            <h4 style="${isCancelled ? 'text-decoration:line-through; color:#999;' : ''}">${l.subject}</h4>
                            <span class="status-badge" style="${isCancelled ? 'background:#d32f2f; color:white;' : 'background:#e8f5e9; color:green;'}">${l.status}</span>
                        </div>
                        <div class="lesson-detail"><i class="fas fa-user-graduate"></i> ${l.tutor_name_cache || 'Tutor'}</div>
                        <div class="lesson-detail"><i class="far fa-calendar"></i> ${d} - ${l.time_slot}</div>
                        
                        ${roomInfo}
                        ${cancelReasonDisplay}

                        ${l.notes && !isCancelled ? `<div class="lesson-detail" style="font-style:italic; margin-top:5px; color:#666;"><i class="far fa-comment"></i> ${l.notes}</div>` : ''}
                    </div>
                    ${buttonsDisplay}
                `;
                myLessonsList.appendChild(item);
            });
        } catch(e) { console.error(e); }
    }

    // --- 4. GESTIONE MODALI (SALVA/ANNULLA) ---

    // Submit Modifica
    const editForm = document.getElementById('editForm');
    if(editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const d = document.getElementById('editDate').value;
            const t = document.getElementById('editTime').value;
            const note = document.getElementById('editNotes').value;
            let dur = document.getElementById('editDuration').value;
            
            if(!dur.includes('min')) dur += " min";

            const subjInput = document.getElementById('editSubject');
            const subject = subjInput ? subjInput.value : null;

            const updateData = { date: d, time_slot: t, notes: note, duration: dur };
            if(subject) updateData.subject = subject;

            try {
                const { error } = await sbClient.from('appointments').update(updateData).eq('id', idToModify);
                if(error) throw error;
                closeModal(editModal);
                showSuccess("Fatto", "Lezione aggiornata.");
                fetchLessons();
            } catch(err) { showWarning("Errore: " + err.message); }
        });
    }

    // Conferma Cancellazione
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if(btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', async () => {
            if(idToModify) {
                await sbClient.from('appointments').delete().eq('id', idToModify);
                closeModal(deleteModal);
                fetchLessons();
                showSuccess("Cancellata", "Lezione eliminata.");
            }
        });
    }

    // Chiusura Modali
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    if(btnCancelEdit) btnCancelEdit.addEventListener('click', () => closeModal(editModal));

    const btnCancelDelete = document.getElementById('btnCancelDelete');
    if(btnCancelDelete) btnCancelDelete.addEventListener('click', () => closeModal(deleteModal));

    const btnSuccessClose = document.getElementById('btnSuccessClose');
    if(btnSuccessClose) btnSuccessClose.addEventListener('click', () => closeModal(successModal));

    const btnWarningClose = document.getElementById('btnWarningClose');
    if(btnWarningClose) btnWarningClose.addEventListener('click', () => closeModal(warningModal));


    // --- 5. LOGICA PRENOTAZIONE (FILTRI E ORARI) ---

    function filterTutors() {
        const y = filterYear.value;
        const s = filterSubject.value.toLowerCase().trim();
        selectTutor.innerHTML = '<option value="">Seleziona...</option>';
        selectTutor.disabled = true;
        resetDateAndTime();

        if(!y || s.length < 2) return;

        const filtered = allTutors.filter(t => {
            const c = t.class_info ? t.class_info.toString() : "";
            const sub = t.subjects ? t.subjects.toLowerCase() : "";
            return c.startsWith(y) && sub.includes(s);
        });

        if(filtered.length > 0) {
            selectTutor.disabled = false;
            filtered.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                let name = t.full_name || "Tutor";
                opt.textContent = `${name} (${t.class_info || 'ND'})`;
                opt.setAttribute('data-avail', t.availability || ""); 
                selectTutor.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.textContent = "Nessun tutor trovato";
            selectTutor.appendChild(opt);
        }
    }
    filterYear.addEventListener('change', filterTutors);
    filterSubject.addEventListener('input', filterTutors);

    selectTutor.addEventListener('change', () => {
        resetDateAndTime();
        const selectedOption = selectTutor.options[selectTutor.selectedIndex];
        const rawAvail = selectedOption.getAttribute('data-avail');
        if (!rawAvail) {
            availDisplay.style.display = 'none';
            alert("Tutor senza orari predefiniti.");
            return;
        }
        currentTutorAvailability = [];
        const parts = rawAvail.split(',');
        parts.forEach(part => {
            part = part.trim();
            const spaceIndex = part.indexOf(' ');
            if (spaceIndex === -1) return;
            const dayName = part.substring(0, spaceIndex).trim().toLowerCase();
            const timeRange = part.substring(spaceIndex + 1).trim();
            if (DAY_MAP.hasOwnProperty(dayName)) {
                currentTutorAvailability.push({ dayIndex: DAY_MAP[dayName], range: timeRange });
            }
        });
        availText.textContent = rawAvail;
        availDisplay.style.display = 'block';
        dateInput.disabled = false;
        dateInput.style.opacity = "1";
        dateInput.min = new Date().toISOString().split('T')[0];
    });

    dateInput.addEventListener('change', () => {
        const selectedDate = new Date(dateInput.value);
        const dayOfWeek = selectedDate.getDay();
        const validSlots = currentTutorAvailability.filter(item => item.dayIndex === dayOfWeek);

        if (validSlots.length > 0) {
            dateError.style.display = 'none';
            timeSelect.disabled = false;
            timeSelect.style.opacity = "1";
            timeSelect.style.cursor = "pointer";
            timeSelect.innerHTML = '<option value="">-- Scegli Orario --</option>';
            validSlots.forEach(slot => {
                const opt = document.createElement('option');
                opt.value = slot.range;
                opt.textContent = slot.range;
                timeSelect.appendChild(opt);
            });
            timeSelect.style.backgroundColor = "#e8f5e9";
        } else {
            dateError.style.display = 'block';
            timeSelect.innerHTML = '<option value="">-- Data non valida --</option>';
            timeSelect.disabled = true;
            timeSelect.style.backgroundColor = "#ffebee";
            timeSelect.value = "";
        }
    });

    function resetDateAndTime() {
        dateInput.value = "";
        dateInput.disabled = true;
        dateInput.style.opacity = "0.6";
        dateError.style.display = 'none';
        timeSelect.innerHTML = '<option value="">-- Prima seleziona data --</option>';
        timeSelect.disabled = true;
        timeSelect.style.opacity = "0.6";
        timeSelect.style.backgroundColor = "";
        availDisplay.style.display = 'none';
    }

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tid = selectTutor.value;
        const sub = filterSubject.value;
        const date = dateInput.value;
        const time = timeSelect.value;
        const durEl = document.querySelector('input[name="duration"]:checked');
        const dur = durEl ? durEl.value + " min" : "60 min";
        const notes = document.getElementById('lessonNotes').value;

        if(!tid || !date || !time) { showWarning("Compila tutti i campi."); return; }

        try {
            const tName = selectTutor.options[selectTutor.selectedIndex].text.split(' (')[0];
            const { error } = await sbClient.from('appointments').insert([{
                user_id: user.id, tutor_id: tid, student_name: user.user_metadata.full_name || user.email,
                student_email: user.email, subject: sub, date: date, time_slot: time,
                duration: dur, status: 'Confermato', tutor_name_cache: tName, notes: notes
            }]);
            if(error) throw error;
            showSuccess("Prenotata!", "Lezione confermata.");
            bookingForm.reset();
            resetDateAndTime();
            selectTutor.innerHTML = '<option value="">Seleziona...</option>';
            selectTutor.disabled = true;
            fetchLessons();
        } catch(e) { showWarning(e.message); }
    });

    // Avvio
    fetchLessons();
});