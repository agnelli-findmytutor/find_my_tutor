(function() {
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
let tutorIdToRate = null; // ID del tutor da recensire
let currentTutorAvailability = []; 
let isGroupMode = false;
let allStudents = [];
let selectedStudents = [];

// --- HELPER TIME FUNCTIONS ---
const timeToMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const minToTime = (m) => { const h = Math.floor(m/60); const mn = m%60; return `${h.toString().padStart(2,'0')}:${mn.toString().padStart(2,'0')}`; };

document.addEventListener('DOMContentLoaded', async () => {

    // --- ELEMENTI DOM ---
    const filterYear = document.getElementById('filterYear');
    const filterSchoolType = document.getElementById('filterSchoolType');
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

    // --- LOGICA GRUPPO ---
    const btnToggleGroup = document.getElementById('btnToggleGroup');
    const groupSection = document.getElementById('groupSection');
    const bookingCard = document.querySelector('.booking-card');
    const searchInput = document.getElementById('searchStudent');
    const resultsDiv = document.getElementById('studentResults');
    const chipsContainer = document.getElementById('selectedStudents');

    btnToggleGroup.onclick = async () => {
        isGroupMode = !isGroupMode;
        btnToggleGroup.classList.toggle('active');
        groupSection.classList.toggle('hidden');
        bookingCard.classList.toggle('group-mode');
        
        if(isGroupMode && allStudents.length === 0) {
            const { data } = await sbClient.from('profiles').select('id, full_name, email');
            allStudents = data.filter(s => s.id !== user.id); // Escludi se stessi
        }
    };

    searchInput.oninput = () => {
        const val = searchInput.value.toLowerCase();
        if(val.length < 2) { resultsDiv.classList.add('hidden'); return; }
        
        const filtered = allStudents.filter(s => 
            (s.full_name?.toLowerCase().includes(val) || s.email.toLowerCase().includes(val)) &&
            !selectedStudents.find(sel => sel.id === s.id)
        ).slice(0, 5);

        if(filtered.length > 0) {
            resultsDiv.innerHTML = filtered.map(s => `
                <div class="search-item" onclick="addStudentToGroup('${s.id}', '${s.full_name || s.email}')">
                    ${s.full_name || 'Studente'} <br><small>${s.email}</small>
                </div>
            `).join('');
            resultsDiv.classList.remove('hidden');
        } else {
            resultsDiv.classList.add('hidden');
        }
    };

    window.addStudentToGroup = (id, name) => {
        if(selectedStudents.length >= 5) { alert("Massimo 5 compagni aggiuntivi."); return; }
        selectedStudents.push({ id, name });
        renderChips();
        searchInput.value = '';
        resultsDiv.classList.add('hidden');
    };

    window.removeStudent = (id) => {
        selectedStudents = selectedStudents.filter(s => s.id !== id);
        renderChips();
    };

    function renderChips() {
        chipsContainer.innerHTML = selectedStudents.map(s => `
            <div class="student-chip">
                ${s.name} <i class="fas fa-times" onclick="removeStudent('${s.id}')"></i>
            </div>
        `).join('');
    }

    // --- LOGICA MOSTRA/NASCONDI SEZIONI ---
    const btnTogglePast = document.getElementById('btnTogglePast');
    const pastList = document.getElementById('pastLessonsList');
    if(btnTogglePast && pastList) {
        btnTogglePast.onclick = () => {
            const isHidden = pastList.classList.toggle('hidden');
            btnTogglePast.innerHTML = isHidden ? '<i class="fas fa-eye"></i> Mostra' : '<i class="fas fa-eye-slash"></i> Nascondi';
        };
    }

    const btnToggleCancelled = document.getElementById('btnToggleCancelled');
    const cancelledList = document.getElementById('cancelledLessonsList');
    if(btnToggleCancelled && cancelledList) {
        btnToggleCancelled.onclick = () => {
            const isHidden = cancelledList.classList.toggle('hidden');
            btnToggleCancelled.innerHTML = isHidden ? '<i class="fas fa-eye"></i> Mostra' : '<i class="fas fa-eye-slash"></i> Nascondi';
        };
    }

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

        // Cerca se è stato cliccato un bottone RECENSISCI
        const btnRate = e.target.closest('.btn-action-rate');
        if (btnRate) {
            idToModify = btnRate.getAttribute('data-id');
            tutorIdToRate = btnRate.getAttribute('data-tutor');
            document.getElementById('ratingModal').classList.remove('hidden');
        }
    });

    // --- LOGICA APERTURA MODALI ---

    async function openEditModal(id) {
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
        document.getElementById('editTutorId').value = lesson.tutor_id;
        document.getElementById('editNotes').value = lesson.notes || '';
        
        // Gestione durata
        let dur = lesson.duration || '60';
        dur = dur.replace(' min', '').trim(); // Pulisce "60 min" -> "60"
        document.getElementById('editDuration').value = dur + " min"; // Rimette "60 min" per combaciare con la select

        // Gestione materia
        const subjInput = document.getElementById('editSubject');
        if(subjInput) subjInput.value = lesson.subject || '';

        // Calcola gli orari disponibili per la data corrente
        await updateEditTimeSlots();
        
        // Seleziona l'orario attuale della lezione se presente tra le opzioni
        const timeSelect = document.getElementById('editTime');
        const currentStartTime = lesson.time_slot.split('-')[0].trim();
        timeSelect.value = currentStartTime;

        editModal.classList.remove('hidden');
    }

    // Nuova funzione per calcolare gli orari nel modale di modifica
    async function updateEditTimeSlots() {
        const dateVal = document.getElementById('editDate').value;
        const timeSelect = document.getElementById('editTime');
        const tutorId = document.getElementById('editTutorId').value;
        const currentAppId = document.getElementById('editLessonId').value;

        if(!dateVal || !tutorId) return;

        const selectedDate = new Date(dateVal);
        const dayOfWeek = selectedDate.getDay();
        
        // Recupera il tutor per avere la sua stringa di disponibilità
        const tutor = allTutors.find(t => t.id === tutorId);
        if(!tutor || !tutor.availability) return;

        const tutorAvail = [];
        tutor.availability.split(',').forEach(part => {
            part = part.trim();
            const spaceIndex = part.indexOf(' ');
            if (spaceIndex === -1) return;
            const dayName = part.substring(0, spaceIndex).trim().toLowerCase();
            const timeRange = part.substring(spaceIndex + 1).trim();
            if (DAY_MAP.hasOwnProperty(dayName)) {
                tutorAvail.push({ dayIndex: DAY_MAP[dayName], range: timeRange });
            }
        });

        const validRanges = tutorAvail.filter(item => item.dayIndex === dayOfWeek);

        if (validRanges.length === 0) {
            timeSelect.innerHTML = '<option value="">-- Tutor non disponibile --</option>';
            timeSelect.disabled = true;
            return;
        }

        timeSelect.innerHTML = '<option value="">Caricamento...</option>';
        
        // Recupera lezioni esistenti escludendo quella attuale (per permettere di mantenere lo stesso slot)
        const { data: existingApps } = await sbClient
            .from('appointments')
            .select('id, time_slot, duration')
            .eq('tutor_id', tutorId)
            .eq('date', dateVal)
            .neq('status', 'Cancellata')
            .neq('id', currentAppId); 

        const occupiedSet = new Set();
        (existingApps || []).forEach(app => {
            const start = timeToMin(app.time_slot);
            const dur = parseInt(app.duration); 
            for(let i=0; i < dur; i+=30) occupiedSet.add(start + i);
        });

        const availableOptions = [];
        validRanges.forEach(slot => {
            const [sStr, eStr] = slot.range.split('-');
            const startRange = timeToMin(sStr.trim());
            const endRange = timeToMin(eStr.trim());

            for(let t = startRange; t < endRange; t += 30) {
                if (!occupiedSet.has(t) && !occupiedSet.has(t+30) && (t + 60 <= endRange)) {
                    let maxDur = 60;
                    if (!occupiedSet.has(t+60) && (t + 90 <= endRange)) maxDur = 90;
                    availableOptions.push({ time: minToTime(t), maxDur: maxDur });
                }
            }
        });

        timeSelect.innerHTML = '<option value="">-- Scegli Orario --</option>';
        if(availableOptions.length > 0) {
            availableOptions.sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
            availableOptions.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.time;
                opt.textContent = optData.time;
                opt.setAttribute('data-max-duration', optData.maxDur);
                timeSelect.appendChild(opt);
            });
            timeSelect.disabled = false;
        } else {
            timeSelect.innerHTML = '<option value="">Tutto occupato</option>';
        }
    }

    // Listener per il cambio data nel modale di modifica
    const editDateInput = document.getElementById('editDate');
    if(editDateInput) {
        editDateInput.addEventListener('change', updateEditTimeSlots);
    }

    // Listener per gestire la durata nel modale di modifica
    const editTimeSelect = document.getElementById('editTime');
    if(editTimeSelect) {
        editTimeSelect.addEventListener('change', () => {
            const selectedOpt = editTimeSelect.options[editTimeSelect.selectedIndex];
            if(!selectedOpt || !selectedOpt.value) return;
            const maxDur = selectedOpt.getAttribute('data-max-duration');
            const durSelect = document.getElementById('editDuration');
            
            // Se lo spazio è solo di 60 min, nascondi o disabilita l'opzione 90 min
            const opt90 = durSelect.querySelector('option[value="90 min"]');
            if (maxDur === '60') {
                if(opt90) opt90.disabled = true;
                durSelect.value = "60 min";
            } else {
                if(opt90) opt90.disabled = false;
            }
        });
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
        const upcomingList = document.getElementById('myLessonsList');
        const pastList = document.getElementById('pastLessonsList');
        const cancelledList = document.getElementById('cancelledLessonsList');
        upcomingList.innerHTML = '<p style="text-align:center">Caricamento...</p>';
        if(pastList) pastList.innerHTML = '';
        if(cancelledList) cancelledList.innerHTML = '';

        try {
            // Calcola data limite (30 giorni fa)
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 30);
            const limitStr = limitDate.toISOString().split('T')[0];

            // Recupera lezioni
            const { data } = await sbClient.from('appointments').select('*').eq('user_id', user.id).order('date', {ascending:true});
            
            // Recupera ID delle lezioni già recensite per questo utente
            const { data: ratedData } = await sbClient.from('tutor_ratings').select('appointment_id');
            const ratedIds = new Set(ratedData ? ratedData.map(r => r.appointment_id) : []);

            // Filtra: Nascondi le cancellate più vecchie di 30 giorni
            currentLessons = (data || []).filter(l => {
                if (l.status === 'Cancellata' && l.date < limitStr) return false;
                return true;
            });

            upcomingList.innerHTML = '';
            if(pastList) pastList.innerHTML = '';
            if(cancelledList) cancelledList.innerHTML = '';

            let hasUpcoming = false;
            let hasPast = false;
            let hasCancelled = false;

            currentLessons.forEach(l => {
                const d = new Date(l.date).toLocaleDateString('it-IT');
                const today = new Date().toISOString().split('T')[0];
                const isCancelled = l.status === 'Cancellata';
                const isPast = !isCancelled && l.date < today;
                
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

                // Logica Bottoni: Modifica/Annulla se futura, Recensisci se passata o conclusa
                let buttonsDisplay = '';
                let statusText = l.status;
                let statusStyle = isCancelled ? 'background:#d32f2f; color:white;' : 'background:#e8f5e9; color:green;';

                if (isCancelled) {
                    buttonsDisplay = `<div style="text-align:right; font-size:0.8rem; color:#d32f2f; font-weight:bold; margin-top:10px;">Lezione Annullata</div>`;
                } else if (isPast) {
                    statusText = "Conclusa";
                    statusStyle = "background:#f5f5f5; color:#666;";
                    const alreadyRated = ratedIds.has(l.id);
                    buttonsDisplay = alreadyRated 
                        ? `<div style="text-align:right; color:#2e7d32; font-size:0.8rem; font-weight:bold; margin-top:10px;"><i class="fas fa-check-circle"></i> Recensita</div>`
                        : `<div class="lesson-actions"><button class="btn-mini btn-action-rate" style="background:#fff8e1; color:#ffa000; width:120px;" data-id="${l.id}" data-tutor="${l.tutor_id}"><i class="fas fa-star"></i> Recensisci</button></div>`;
                } else {
                    buttonsDisplay = `<div class="lesson-actions">
                        <button class="btn-mini edit btn-action-edit" data-id="${l.id}"><i class="fas fa-pen"></i> Modifica</button>
                        <button class="btn-mini delete btn-action-delete" data-id="${l.id}"><i class="fas fa-trash"></i> Annulla</button>
                    </div>`;
                }

                const item = document.createElement('div');
                item.className = 'lesson-item';
                if(isCancelled) item.style.cssText = "border-left: 4px solid #d32f2f; background: #fff5f5;";
                if(isPast) item.style.cssText = "border-left: 4px solid #999; background: #fafafa; opacity: 0.8;";

                item.innerHTML = `
                    <div style="flex:1">
                        <div class="lesson-header">
                            <h4 style="${(isCancelled || isPast) ? 'color:#999;' : ''} ${isCancelled ? 'text-decoration:line-through;' : ''}">${l.subject}</h4>
                            <span class="status-badge" style="${statusStyle}">${statusText}</span>
                        </div>
                        <div class="lesson-detail"><i class="fas fa-user-graduate"></i> ${l.tutor_name_cache || 'Tutor'}</div>
                        <div class="lesson-detail"><i class="far fa-calendar"></i> ${d} - ${l.time_slot}</div>
                        
                        ${roomInfo}
                        ${cancelReasonDisplay}

                        ${l.notes && !isCancelled ? `<div class="lesson-detail" style="font-style:italic; margin-top:5px; color:#666;"><i class="far fa-comment"></i> ${l.notes}</div>` : ''}
                    </div>
                    ${buttonsDisplay}
                `;
                
                if (isCancelled) {
                    if (cancelledList) cancelledList.appendChild(item);
                    hasCancelled = true;
                } else if (isPast) {
                    if (pastList) pastList.appendChild(item);
                    hasPast = true;
                } else {
                    upcomingList.appendChild(item);
                    hasUpcoming = true;
                }
            });

            if(!hasUpcoming) {
                upcomingList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Nessuna lezione in programma.</p></div>';
            }
            if(!hasPast && pastList) {
                pastList.innerHTML = '<p class="empty-state" style="padding: 20px; font-size: 0.9rem;">Nessuna lezione conclusa.</p>';
            }
            if(!hasCancelled && cancelledList) {
                cancelledList.innerHTML = '<p class="empty-state" style="padding: 20px; font-size: 0.9rem;">Nessuna lezione cancellata.</p>';
            }

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
                // MODIFICA: Invece di delete(), facciamo update() per mantenerla nello storico
                await sbClient.from('appointments').update({ 
                    status: 'Cancellata', 
                    cancellation_reason: 'Cancellata dallo studente' 
                }).eq('id', idToModify);
                
                closeModal(deleteModal);
                fetchLessons();
                showSuccess("Cancellata", "La lezione è stata annullata.");
            }
        });
    }

    // --- GESTIONE INVIO RECENSIONE ---
    document.getElementById('btnCancelRating').onclick = () => document.getElementById('ratingModal').classList.add('hidden');
    
    document.getElementById('btnSubmitRating').onclick = async () => {
        const selectedStar = document.querySelector('input[name="stars"]:checked');
        if(!selectedStar) { alert("Seleziona un numero di stelle!"); return; }
        
        const ratingValue = parseInt(selectedStar.value);
        const btn = document.getElementById('btnSubmitRating');
        btn.disabled = true;
        btn.innerText = "Invio...";

        try {
            const { error } = await sbClient.from('tutor_ratings').insert([{
                tutor_id: tutorIdToRate,
                appointment_id: idToModify,
                rating: ratingValue
            }]);
            if(error) throw error;
            document.getElementById('ratingModal').classList.add('hidden');
            showSuccess("Grazie!", "La tua recensione anonima è stata salvata.");
            fetchLessons();
        } catch(e) { alert("Errore: " + e.message); }
        finally { btn.disabled = false; btn.innerText = "Invia Voto"; }
    };

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

    function updateSubjects() {
        const y = filterYear.value;
        const type = filterSchoolType.value;
        filterSubject.innerHTML = '<option value="">Seleziona...</option>';
        filterSubject.disabled = true;
        selectTutor.innerHTML = '<option value="">Seleziona prima la materia...</option>';
        selectTutor.disabled = true;
        resetDateAndTime();

        if (!y || !type) return;

        const subjectSet = new Set();
        allTutors.forEach(t => {
            const classes = t.class_info ? t.class_info.split(' | ') : [];
            const subjectsList = t.subjects ? t.subjects.split(' | ') : [];
            
            classes.forEach((c, idx) => {
                const lowC = c.toLowerCase();
                const matchesYear = lowC.startsWith(y);
                const matchesType = type === "Liceo" ? lowC.includes("liceo") : !lowC.includes("liceo");
                
                if (matchesYear && matchesType && subjectsList[idx]) {
                    subjectsList[idx].split(',').forEach(s => {
                        const cleanSub = s.trim();
                        if (cleanSub) subjectSet.add(cleanSub);
                    });
                }
            });
        });

        if (subjectSet.size > 0) {
            filterSubject.disabled = false;
            Array.from(subjectSet).sort().forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                filterSubject.appendChild(opt);
            });
        } else {
            filterSubject.innerHTML = '<option value="">Nessuna materia disponibile</option>';
        }
    }

    function filterTutors() {
        const y = filterYear.value;
        const s = filterSubject.value;
        const type = filterSchoolType.value;
        selectTutor.innerHTML = '<option value="">Seleziona...</option>';
        selectTutor.disabled = true;
        resetDateAndTime();

        if(!y || !s || !type) return;

        const filtered = allTutors.filter(t => {
            const classes = t.class_info ? t.class_info.split(' | ') : [];
            const subjectsList = t.subjects ? t.subjects.split(' | ') : [];
            
            return classes.some((c, idx) => {
                const lowC = c.toLowerCase();
                const sub = subjectsList[idx] ? subjectsList[idx].toLowerCase() : "";
                const matchesYear = lowC.startsWith(y);
                const matchesType = type === "Liceo" ? lowC.includes("liceo") : !lowC.includes("liceo");
                const matchesSubject = sub.includes(s.toLowerCase());
                return matchesYear && matchesType && matchesSubject;
            });
        });

        if(filtered.length > 0) {
            selectTutor.disabled = false;
            filtered.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                // Mostra il nome completo. Se manca, usa la prima parte dell'email come fallback.
                opt.textContent = t.full_name || t.email.split('@')[0];
                opt.setAttribute('data-avail', t.availability || ""); 
                selectTutor.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.textContent = "Nessun tutor trovato";
            selectTutor.appendChild(opt);
        }
    }
    filterYear.addEventListener('change', updateSubjects);
    filterSchoolType.addEventListener('change', updateSubjects);
    filterSubject.addEventListener('change', filterTutors);

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

    dateInput.addEventListener('change', async () => {
        const dateVal = dateInput.value;
        if(!dateVal) return;

        const selectedDate = new Date(dateVal);
        const dayOfWeek = selectedDate.getDay();
        
        // 1. Trova i range di disponibilità per questo giorno
        const validRanges = currentTutorAvailability.filter(item => item.dayIndex === dayOfWeek);

        if (validRanges.length === 0) {
            dateError.style.display = 'block';
            timeSelect.innerHTML = '<option value="">-- Data non valida --</option>';
            timeSelect.disabled = true;
            timeSelect.style.backgroundColor = "#ffebee";
            return;
        }
        
        dateError.style.display = 'none';
        timeSelect.innerHTML = '<option value="">Caricamento...</option>';
        timeSelect.disabled = true;

        // 2. Recupera lezioni esistenti del tutor per quel giorno (per calcolare i buchi)
        const tutorId = selectTutor.value;
        const { data: existingApps, error } = await sbClient
            .from('appointments')
            .select('time_slot, duration')
            .eq('tutor_id', tutorId)
            .eq('date', dateVal)
            .neq('status', 'Cancellata');
            
        if(error) { console.error(error); return; }

        // 3. Mappa Occupazione (Mattoncini da 30 min)
        const occupiedSet = new Set();
        existingApps.forEach(app => {
            const start = timeToMin(app.time_slot);
            const dur = parseInt(app.duration); 
            // Occupa i blocchi
            for(let i=0; i < dur; i+=30) {
                occupiedSet.add(start + i);
            }
        });

        // 4. Calcola Slot Disponibili (Logica Mattoncini)
        const availableOptions = [];
        
        validRanges.forEach(slot => {
            const [sStr, eStr] = slot.range.split('-');
            const startRange = timeToMin(sStr.trim());
            const endRange = timeToMin(eStr.trim());

            // Itera ogni 30 min partendo dall'inizio del turno del tutor
            for(let t = startRange; t < endRange; t += 30) {
                // Un orario è prenotabile se ALMENO 60 min (2 blocchi) sono liberi
                // Blocco 1: t (Start)
                // Blocco 2: t+30
                
                // Verifica disponibilità blocchi e limiti range
                if (!occupiedSet.has(t) && !occupiedSet.has(t+30) && (t + 60 <= endRange)) {
                    
                    // Calcola se è disponibile anche per 90 min (3 blocchi)
                    let maxDur = 60;
                    if (!occupiedSet.has(t+60) && (t + 90 <= endRange)) {
                        maxDur = 90;
                    }
                    
                    availableOptions.push({
                        time: minToTime(t),
                        maxDur: maxDur
                    });
                }
            }
        });

        // 5. Renderizza Select
        timeSelect.innerHTML = '<option value="">-- Scegli Orario --</option>';
        if(availableOptions.length > 0) {
            // Ordina per orario
            availableOptions.sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
            
            availableOptions.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.time;
                opt.textContent = optData.time;
                opt.setAttribute('data-max-duration', optData.maxDur);
                timeSelect.appendChild(opt);
            });
            
            timeSelect.disabled = false;
            timeSelect.style.backgroundColor = "#e8f5e9";
            timeSelect.style.opacity = "1";
            timeSelect.style.cursor = "pointer";
        } else {
            timeSelect.innerHTML = '<option value="">Tutto occupato</option>';
            timeSelect.style.backgroundColor = "#ffebee";
        }
    });

    // LISTENER PER GESTIRE DURATA (Disabilita 90min se non c'è spazio)
    timeSelect.addEventListener('change', () => {
        const selectedOpt = timeSelect.options[timeSelect.selectedIndex];
        if(!selectedOpt || !selectedOpt.value) return;

        const maxDur = selectedOpt.getAttribute('data-max-duration');
        
        const radio90 = document.getElementById('d90');
        const radio60 = document.getElementById('d60');
        
        if (maxDur === '60') {
            radio90.disabled = true;
            radio90.parentElement.style.opacity = "0.5";
            radio90.parentElement.title = "Non disponibile per questo orario (spazio insufficiente)";
            radio60.checked = true;
        } else {
            radio90.disabled = false;
            radio90.parentElement.style.opacity = "1";
            radio90.parentElement.title = "";
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
})();