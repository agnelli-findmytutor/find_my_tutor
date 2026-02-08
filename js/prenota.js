// CONFIGURAZIONE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabili Globali
let allTutors = []; 
let currentLessons = []; 
let idToModify = null;

document.addEventListener('DOMContentLoaded', async () => {

    // --- ELEMENTI DOM ---
    const filterYear = document.getElementById('filterYear');
    const filterSubject = document.getElementById('filterSubject');
    const selectTutor = document.getElementById('selectTutor');
    const bookingForm = document.getElementById('bookingForm');
    const myLessonsList = document.getElementById('myLessonsList');

    // Modali
    const successModal = document.getElementById('successModal');
    const deleteModal = document.getElementById('deleteModal');
    const warningModal = document.getElementById('warningModal');
    const editModal = document.getElementById('editModal');

    // --- FUNZIONI UTILI ---
    function showSuccess(t, m) {
        document.getElementById('successTitle').textContent = t;
        document.getElementById('successMessage').textContent = m;
        successModal.classList.remove('hidden');
    }
    
    function showWarning(m) {
        document.getElementById('warningMessage').innerHTML = m;
        warningModal.classList.remove('hidden');
    }
    
    function closeModal(m) { m.classList.add('hidden'); }

    // Controllo 24 Ore
    function check24Hours(dateString, timeString) {
        try {
            const now = new Date();
            const lessonDate = new Date(`${dateString}T${timeString}`);
            const diffMs = lessonDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);
            return diffHours >= 24;
        } catch (e) {
            console.error("Errore data", e);
            return true; // Se errore, permetti (fallback)
        }
    }

    function getTutorEmail(tid) {
        const t = allTutors.find(x => x.id === tid);
        return t && t.email ? t.email : 'segreteria@istitutoagnelli.it';
    }

    // --- LOGICA MODALI ---
    
    // Funzione APRI MODIFICA
    function handleOpenEdit(id) {
        const lesson = currentLessons.find(l => l.id === id);
        
        if(!lesson) return;

        // Controllo 24h
        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`
                <strong>Modifica bloccata.</strong><br>
                Mancano meno di 24 ore.<br><br>
                Contatta il tutor: <a href="mailto:${email}">${email}</a>
            `);
            return;
        }

        idToModify = id;
        
        // Popola i campi
        document.getElementById('editLessonId').value = lesson.id;
        document.getElementById('editDate').value = lesson.date;
        document.getElementById('editTime').value = lesson.time_slot;
        document.getElementById('editSubject').value = lesson.subject || '';
        document.getElementById('editNotes').value = lesson.notes || '';
        
        // Durata
        let dur = lesson.duration || '60 min';
        if(!dur.includes("min")) dur += " min";
        document.getElementById('editDuration').value = dur;

        editModal.classList.remove('hidden');
    }

    // Funzione APRI ANNULLA
    function handleOpenDelete(id) {
        const lesson = currentLessons.find(l => l.id === id);
        if(!lesson) return;

        // Controllo 24h
        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`
                <strong>Impossibile annullare.</strong><br>
                Mancano meno di 24 ore.<br><br>
                Scrivi al tutor: <a href="mailto:${email}">${email}</a>
            `);
            return;
        }

        idToModify = id;
        deleteModal.classList.remove('hidden');
    }

    // --- CHECK USER ---
    const { data: { user } } = await sbClient.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    // --- 1. CARICA TUTOR ---
    async function loadTutors() {
        try {
            const { data } = await sbClient.from('profiles').select('*').eq('role', 'tutor');
            allTutors = data || [];
        } catch(e) { console.error(e); }
    }
    await loadTutors();

    // --- 2. FILTRI ---
    function filterTutors() {
        const y = filterYear.value;
        const s = filterSubject.value.toLowerCase().trim();
        selectTutor.innerHTML = '<option value="">Seleziona...</option>';
        selectTutor.disabled = true;

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
                let name = t.full_name || (t.first_name + ' ' + t.last_name);
                if(!t.full_name && !t.first_name) name = "Staff Tutor";
                opt.textContent = `${name} (${t.class_info || 'ND'})`;
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

    // --- 3. PRENOTA (Submit) ---
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tid = selectTutor.value;
        const sub = filterSubject.value;
        const date = document.getElementById('lessonDate').value;
        const time = document.getElementById('lessonTime').value;
        const dur = document.querySelector('input[name="duration"]:checked').value;
        const notes = document.getElementById('lessonNotes') ? document.getElementById('lessonNotes').value : '';

        if(!tid) { showWarning("Seleziona tutor"); return; }

        try {
            const tName = selectTutor.options[selectTutor.selectedIndex].text.split(' (')[0];
            const { error } = await sbClient.from('appointments').insert([{
                user_id: user.id,
                tutor_id: tid,
                student_name: user.user_metadata.full_name || user.email,
                student_email: user.email,
                subject: sub,
                date: date,
                time_slot: time,
                duration: dur + " min",
                status: 'Confermato',
                tutor_name_cache: tName,
                notes: notes
            }]);
            if(error) throw error;
            showSuccess("Prenotata!", "Lezione confermata.");
            bookingForm.reset();
            selectTutor.disabled = true;
            fetchLessons();
        } catch(e) { showWarning(e.message); }
    });

    // --- 4. LISTA LEZIONI (AGGIORNATA CON AULA) ---
    // --- 4. LISTA LEZIONI (AGGIORNATA PER VEDERE CANCELLAZIONI) ---
    async function fetchLessons() {
        myLessonsList.innerHTML = '<p style="text-align:center">Caricamento...</p>';
        try {
            const { data } = await sbClient.from('appointments').select('*').eq('user_id', user.id).order('date', {ascending:true});
            
            currentLessons = data || [];
            myLessonsList.innerHTML = '';
            
            if(currentLessons.length === 0) {
                myLessonsList.innerHTML = '<div class="empty-state"><p>Nessuna lezione.</p></div>';
                return;
            }

            currentLessons.forEach(l => {
                const d = new Date(l.date).toLocaleDateString('it-IT');
                const isCancelled = l.status === 'Cancellata';
                
                // Colore Badge
                let badgeClass = 'confermato'; // Verde default
                if(isCancelled) badgeClass = 'cancellato'; // Rosso (definiremo il css se manca)

                // Stile specifico per lezione cancellata
                const cardStyle = isCancelled 
                    ? "background:#ffebee; border-color:#ef5350;" 
                    : "background:white;";

                // Logica Aula (Mostra solo se attiva)
                let roomInfo = '';
                if (!isCancelled) {
                    roomInfo = l.room_name 
                    ? `<div class="lesson-detail" style="color:#1565c0; font-weight:600; margin-top:5px;"><i class="fas fa-map-marker-alt"></i> Aula: ${l.room_name}</div>`
                    : `<div class="lesson-detail" style="color:#999; font-style:italic; margin-top:5px;"><i class="fas fa-door-closed"></i> Aula da definire</div>`;
                }

                // Logica Motivo Cancellazione
                const cancelReasonDisplay = isCancelled
                    ? `<div style="margin-top:10px; background:white; padding:10px; border-radius:8px; border-left:4px solid #d32f2f; color:#c62828;">
                         <strong><i class="fas fa-ban"></i> Cancellata dal Tutor:</strong><br>
                         <span style="font-style:italic;">"${l.cancellation_reason || 'Nessun motivo specificato'}"</span>
                       </div>`
                    : '';

                // Pulsanti (Nascondi se cancellata)
                const buttonsDisplay = isCancelled 
                    ? `<div style="text-align:right; font-size:0.8rem; color:#d32f2f; font-weight:bold; margin-top:10px;">Lezione Annullata</div>`
                    : `<div class="lesson-actions">
                        <button class="btn-mini edit btn-edit-action"><i class="fas fa-pen"></i> Modifica</button>
                        <button class="btn-mini delete btn-delete-action"><i class="fas fa-trash"></i> Annulla</button>
                       </div>`;

                const item = document.createElement('div');
                item.className = 'lesson-item';
                // Sovrascriviamo lo stile inline per renderla rossa se cancellata
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

                // Listener solo se non è cancellata
                if(!isCancelled) {
                    const btnEdit = item.querySelector('.btn-edit-action');
                    const btnDelete = item.querySelector('.btn-delete-action');
                    if(btnEdit) btnEdit.addEventListener('click', () => handleOpenEdit(l.id));
                    if(btnDelete) btnDelete.addEventListener('click', () => handleOpenDelete(l.id));
                }

                myLessonsList.appendChild(item);
            });
        } catch(e) { console.error(e); }
    }

    // --- EVENTI PULSANTI MODALI ---
    
    // Conferma Modifica
    document.getElementById('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = document.getElementById('editDate').value;
        const t = document.getElementById('editTime').value;
        const sub = document.getElementById('editSubject').value;
        const note = document.getElementById('editNotes').value;
        const dur = document.getElementById('editDuration').value;

        try {
            const { error } = await sbClient.from('appointments').update({
                date: d, time_slot: t, subject: sub, notes: note, duration: dur
            }).eq('id', idToModify);

            if(error) throw error;
            closeModal(editModal);
            showSuccess("Fatto", "Lezione aggiornata.");
            fetchLessons();
        } catch(err) { showWarning("Errore: " + err.message); }
    });

    // Conferma Cancellazione
    document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
        if(idToModify) {
            await sbClient.from('appointments').delete().eq('id', idToModify);
            closeModal(deleteModal);
            fetchLessons();
        }
    });

    // Chiusura Modali
    document.getElementById('btnCancelEdit').addEventListener('click', () => closeModal(editModal));
    document.getElementById('btnCancelDelete').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('btnSuccessClose').addEventListener('click', () => closeModal(successModal));
    document.getElementById('btnWarningClose').addEventListener('click', () => closeModal(warningModal));

    // Init
    fetchLessons();
});