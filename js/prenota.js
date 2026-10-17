(function() {
// CONFIGURAZIONE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mappa giorni
const DAY_MAP = {
    'domenica': 0, 'lunedì': 1, 'lunedi': 1, 'martedì': 2, 'martedi': 2,
    'mercoledì': 3, 'mercoledi': 3, 'giovedì': 4, 'giovedi': 4,
    'venerdì': 5, 'venerdi': 5, 'sabato': 6
};

// Variabili Globali
let allTutors = []; 
let currentLessons = []; 
let idToModify = null;
let tutorIdToRate = null;
let currentTutorAvailability = []; 
let isGroupMode = false;
let allStudents = [];
let selectedStudents = [];

// --- HELPER TIME FUNCTIONS ---
const timeToMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const minToTime = (m) => { const h = Math.floor(m/60); const mn = m%60; return `${h.toString().padStart(2,'0')}:${mn.toString().padStart(2,'0')}`; };

const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe || '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

document.addEventListener('DOMContentLoaded', async () => {

    // --- ELEMENTI DOM ---
    const filterYear = document.getElementById('filterYear');
    const filterSchoolType = document.getElementById('filterSchoolType');
    const filterSubject = document.getElementById('filterSubject');
    const selectTutor = document.getElementById('selectTutor');
    const tutorCardsContainer = document.getElementById('tutorCardsContainer');
    const bookingForm = document.getElementById('bookingForm');
    const myLessonsList = document.getElementById('myLessonsList');

    // Inputs Prenotazione
    const dateInput = document.getElementById('selectDate');
    const timeSelect = document.getElementById('selectTime');
    const timePillsWrapper = document.getElementById('timePillsWrapper');
    const timePillsGrid = document.getElementById('timePillsGrid');
    const availDisplay = document.getElementById('tutorAvailDisplay');
    const availText = document.getElementById('availText');
    const dateError = document.getElementById('dateError');
    const lessonNotes = document.getElementById('lessonNotes');

    // Modali
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const successModal = document.getElementById('successModal');
    const warningModal = document.getElementById('warningModal');

    // --- SWITCHER VISTA MOBILE (PRENOTA vs LE MIE LEZIONI) ---
    const btnViewBooking = document.getElementById('btnViewBooking');
    const btnViewList = document.getElementById('btnViewList');
    const bookingCard = document.querySelector('.booking-card');
    const listCard = document.querySelector('.list-card');

    if (btnViewBooking && btnViewList && bookingCard && listCard) {
        const switchView = (toView) => {
            if (toView === 'list') {
                btnViewList.classList.add('active');
                btnViewList.setAttribute('aria-selected', 'true');
                btnViewBooking.classList.remove('active');
                btnViewBooking.setAttribute('aria-selected', 'false');
                listCard.classList.remove('mobile-hidden');
                bookingCard.classList.add('mobile-hidden');
            } else {
                btnViewBooking.classList.add('active');
                btnViewBooking.setAttribute('aria-selected', 'true');
                btnViewList.classList.remove('active');
                btnViewList.setAttribute('aria-selected', 'false');
                bookingCard.classList.remove('mobile-hidden');
                listCard.classList.add('mobile-hidden');
            }
        };

        btnViewBooking.addEventListener('click', () => switchView('booking'));
        btnViewList.addEventListener('click', () => switchView('list'));

        const initResponsiveView = () => {
            if (window.innerWidth <= 991) {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('view') === 'list' || btnViewList.classList.contains('active')) {
                    switchView('list');
                } else {
                    switchView('booking');
                }
            } else {
                bookingCard.classList.remove('mobile-hidden');
                listCard.classList.remove('mobile-hidden');
            }
        };

        initResponsiveView();
        window.addEventListener('resize', initResponsiveView);
    }

    // --- 1. CHECK UTENTE (HYBRID MASTERCOM + SUPABASE UNIFICATO) ---
    let fmtUser = (typeof FMT_API !== 'undefined') ? FMT_API.getCurrentUser() : null;
    let user = null;

    let sbUser = null;
    try {
        const { data } = await sbClient.auth.getUser();
        sbUser = data?.user;
    } catch(e) {}

    if (sbUser) {
        user = sbUser;
        if (fmtUser) {
            user.id = fmtUser.google_id || sbUser.id;
        }
    } else if (fmtUser) {
        user = {
            id: fmtUser.google_id || fmtUser.id,
            email: fmtUser.google_email || fmtUser.email,
            user_metadata: {
                full_name: fmtUser.full_name,
                avatar_url: fmtUser.avatar_url
            }
        };
    } else {
        window.location.href = "login.html";
        return;
    }

    const isMastercomUser = !sbUser && !!fmtUser;

    // --- STEPPER & LIVE SUMMARY LOGIC ---
    function updateStepperAndSummary() {
        const hasStep1 = !!(filterYear.value && filterSchoolType.value && filterSubject.value);
        const hasStep2 = !!(hasStep1 && selectTutor.value);
        const hasStep3 = !!(hasStep2 && dateInput.value && timeSelect.value);

        let activeStep = 1;
        if (hasStep1) activeStep = 2;
        if (hasStep2) activeStep = 3;
        if (hasStep3) activeStep = 4;

        const fillEl = document.getElementById('stepperFill');
        if (fillEl) {
            const pctMap = { 1: 15, 2: 45, 3: 75, 4: 100 };
            fillEl.style.width = `${pctMap[activeStep]}%`;
        }

        document.querySelectorAll('.step-node').forEach(node => {
            const s = parseInt(node.getAttribute('data-step'), 10);
            node.classList.remove('active', 'completed');
            if (s < activeStep) node.classList.add('completed');
            else if (s === activeStep) node.classList.add('active');
        });

        [1, 2, 3, 4].forEach(s => {
            const block = document.getElementById(`stepBlock${s}`);
            if (!block) return;
            block.classList.remove('active-step', 'completed-step');
            if (s === activeStep) block.classList.add('active-step');
            else if (s < activeStep) block.classList.add('completed-step');
        });

        // Live Summary Bar
        const summaryBar = document.getElementById('bookingSummaryBar');
        const summaryContent = document.getElementById('bookingSummaryContent');
        if (summaryBar && summaryContent) {
            if (hasStep2) {
                summaryBar.classList.remove('hidden');
                const tName = selectTutor.options[selectTutor.selectedIndex]?.text || 'Tutor';
                const durEl = document.querySelector('input[name="duration"]:checked');
                const durLabel = durEl && durEl.value === '90' ? '1h 30m (90 min)' : '1 Ora (60 min)';
                const dateFormatted = dateInput.value
                    ? new Date(dateInput.value).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })
                    : 'Da scegliere';
                const timeFormatted = timeSelect.value || 'Da scegliere';

                summaryContent.innerHTML = `
                    <span class="summary-pill"><i class="fas fa-book"></i> <strong>${escapeHtml(filterSubject.value)}</strong> (${escapeHtml(filterYear.value)}° ${escapeHtml(filterSchoolType.value)})</span>
                    <span class="summary-pill"><i class="fas fa-user-graduate"></i> ${escapeHtml(tName)}</span>
                    <span class="summary-pill"><i class="far fa-calendar-check"></i> ${escapeHtml(dateFormatted)} • ${escapeHtml(timeFormatted)}</span>
                    <span class="summary-pill"><i class="fas fa-hourglass-half"></i> ${durLabel}</span>
                    ${isGroupMode && selectedStudents.length > 0 ? `<span class="summary-pill"><i class="fas fa-users"></i> Gruppo (+${selectedStudents.length})</span>` : ''}
                `;
            } else {
                summaryBar.classList.add('hidden');
            }
        }
    }

    // --- QUICK PILLS PER ANNO E SCUOLA ---
    function syncQuickPills() {
        const y = filterYear.value;
        const st = filterSchoolType.value;
        document.querySelectorAll('#quickYearPills .q-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-val') === y);
        });
        document.querySelectorAll('#quickSchoolPills .q-pill').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-val') === st);
        });
    }

    document.querySelectorAll('#quickYearPills .q-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            filterYear.value = btn.getAttribute('data-val');
            syncQuickPills();
            updateSubjects();
        });
    });

    document.querySelectorAll('#quickSchoolPills .q-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            filterSchoolType.value = btn.getAttribute('data-val');
            syncQuickPills();
            updateSubjects();
        });
    });

    // Suggerimenti rapidi note
    document.querySelectorAll('.note-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.getAttribute('data-note');
            if (!lessonNotes) return;
            if (!lessonNotes.value.trim()) {
                lessonNotes.value = text;
            } else if (!lessonNotes.value.includes(text)) {
                lessonNotes.value = lessonNotes.value.trim() + ' — ' + text;
            }
            lessonNotes.focus();
        });
    });

    document.querySelectorAll('input[name="duration"]').forEach(r => {
        r.addEventListener('change', updateStepperAndSummary);
    });

    // --- LOGICA GRUPPO ---
    const btnToggleGroup = document.getElementById('btnToggleGroup');
    const groupSection = document.getElementById('groupSection');
    const searchInput = document.getElementById('searchStudent');
    const resultsDiv = document.getElementById('studentResults');
    const chipsContainer = document.getElementById('selectedStudents');
    const groupCountPill = document.getElementById('groupCountPill');

    if (btnToggleGroup) {
        btnToggleGroup.onclick = async () => {
            isGroupMode = !isGroupMode;
            btnToggleGroup.classList.toggle('active', isGroupMode);
            if (groupSection) groupSection.classList.toggle('hidden', !isGroupMode);
            if (bookingCard) bookingCard.classList.toggle('group-mode', isGroupMode);
            updateStepperAndSummary();
            
            if (isGroupMode && allStudents.length === 0) {
                try {
                    const { data } = await sbClient.from('profiles').select('id, full_name, email');
                    if (data) allStudents = data.filter(s => s.id !== user.id);
                } catch(e) {}
            }
        };
    }

    if (searchInput) {
        searchInput.oninput = () => {
            const val = searchInput.value.toLowerCase().trim();
            if (val.length < 2) { resultsDiv.classList.add('hidden'); return; }
            
            const filtered = allStudents.filter(s => 
                (s.full_name?.toLowerCase().includes(val) || (s.email && s.email.toLowerCase().includes(val))) &&
                !selectedStudents.find(sel => sel.id === s.id)
            ).slice(0, 5);

            if (filtered.length > 0) {
                resultsDiv.innerHTML = filtered.map(s => `
                    <div class="search-item" onclick="addStudentToGroup('${escapeHtml(s.id)}', '${escapeHtml(s.full_name || s.email)}')">
                        <strong>${escapeHtml(s.full_name || 'Studente')}</strong> <br><small style="color:#64748b;">${escapeHtml(s.email || '')}</small>
                    </div>
                `).join('');
                resultsDiv.classList.remove('hidden');
            } else {
                resultsDiv.classList.add('hidden');
            }
        };
    }

    window.addStudentToGroup = (id, name) => {
        if (selectedStudents.length >= 5) {
            showWarning("Puoi aggiungere al massimo 5 compagni per una lezione di gruppo.");
            return;
        }
        selectedStudents.push({ id, name });
        renderChips();
        if (searchInput) searchInput.value = '';
        if (resultsDiv) resultsDiv.classList.add('hidden');
        updateStepperAndSummary();
    };

    window.removeStudent = (id) => {
        selectedStudents = selectedStudents.filter(s => s.id !== id);
        renderChips();
        updateStepperAndSummary();
    };

    function renderChips() {
        if (groupCountPill) groupCountPill.textContent = `${selectedStudents.length} / 5`;
        if (!chipsContainer) return;
        chipsContainer.innerHTML = selectedStudents.map(s => `
            <div class="student-chip">
                <i class="fas fa-user"></i> ${escapeHtml(s.name)}
                <i class="fas fa-times" onclick="removeStudent('${escapeHtml(s.id)}')" title="Rimuovi"></i>
            </div>
        `).join('');
    }

    // --- LOGICA MOSTRA/NASCONDI SEZIONI ---
    const btnTogglePast = document.getElementById('btnTogglePast');
    const pastList = document.getElementById('pastLessonsList');
    if (btnTogglePast && pastList) {
        btnTogglePast.onclick = () => {
            const isHidden = pastList.classList.toggle('hidden');
            btnTogglePast.innerHTML = isHidden ? '<i class="fas fa-eye"></i> <span>Mostra</span>' : '<i class="fas fa-eye-slash"></i> <span>Nascondi</span>';
        };
    }

    const btnToggleCancelled = document.getElementById('btnToggleCancelled');
    const cancelledList = document.getElementById('cancelledLessonsList');
    if (btnToggleCancelled && cancelledList) {
        btnToggleCancelled.onclick = () => {
            const isHidden = cancelledList.classList.toggle('hidden');
            btnToggleCancelled.innerHTML = isHidden ? '<i class="fas fa-eye"></i> <span>Mostra</span>' : '<i class="fas fa-eye-slash"></i> <span>Nascondi</span>';
        };
    }

    // --- BANNER MATERIE MASTERCOM ---
    function initMastercomBanner() {
        const banner = document.getElementById('mastercomBanner');
        const classBadge = document.getElementById('mcClassBadge');
        const mcChips = document.getElementById('mastercomChips');
        const btnSync = document.getElementById('btnSyncMastercom');
        const syncIcon = document.getElementById('syncIcon');

        if (!banner || !fmtUser) return;

        const materie = fmtUser.materie || [];
        if (materie.length === 0) return;

        banner.classList.remove('hidden');
        if (classBadge) {
            classBadge.textContent = fmtUser.class_info || (fmtUser.class_year ? `${fmtUser.class_year}° Anno ${fmtUser.school_type || ''}` : 'Orario attivo');
        }

        function renderMcChips() {
            mcChips.innerHTML = '';
            materie.forEach(m => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'mc-subject-chip';
                chip.innerHTML = `<i class="fas fa-book-reader mc-chip-star"></i> <span>${escapeHtml(m)}</span>`;
                chip.onclick = () => {
                    document.querySelectorAll('.mc-subject-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');

                    if (fmtUser.class_year) filterYear.value = String(fmtUser.class_year);
                    if (fmtUser.school_type) filterSchoolType.value = fmtUser.school_type;
                    syncQuickPills();
                    updateSubjects();

                    // Se la materia è tra le opzioni (o la aggiungiamo se necessario)
                    filterSubject.value = m;
                    filterTutors();

                    const step2 = document.getElementById('stepBlock2');
                    if (step2) step2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                };
                mcChips.appendChild(chip);
            });
        }
        renderMcChips();

        if (btnSync) {
            btnSync.onclick = async () => {
                if (syncIcon) syncIcon.classList.add('fa-spin');
                try {
                    const syncRes = await FMT_API.syncProfile();
                    if (syncRes.success && syncRes.user) {
                        fmtUser = syncRes.user;
                        FMT_API.setCurrentUser(fmtUser);
                        if (classBadge) classBadge.textContent = fmtUser.class_info || `${fmtUser.class_year}° Anno ${fmtUser.school_type}`;
                        renderMcChips();
                        updateSubjects();
                        showSuccess("Sincronizzazione completata", "Orario e materie aggiornati dal Registro Elettronico!");
                    } else {
                        showWarning(syncRes.message || "Errore sincronizzazione.");
                    }
                } catch(e) {
                    showWarning("Errore: " + e.message);
                } finally {
                    if (syncIcon) syncIcon.classList.remove('fa-spin');
                }
            };
        }
    }

    // --- FUNZIONI UTILI ---
    function getTutorEmail(tid) {
        const t = allTutors.find(x => x.id === tid);
        return t && t.email ? t.email : 'segreteria@istitutoagnelli.it';
    }

    function check24Hours(dateString, timeString) {
        try {
            const now = new Date();
            const startTime = timeString.split('-')[0].trim();
            const lessonDate = new Date(`${dateString}T${startTime}`);
            const diffMs = lessonDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);
            return diffHours >= 24;
        } catch (e) {
            return true; 
        }
    }

    function showWarning(msg) {
        const wMsg = document.getElementById('warningMessage');
        if (wMsg) wMsg.innerHTML = msg;
        if (warningModal) warningModal.classList.remove('hidden');
    }

    function showSuccess(title, msg) {
        const sTitle = document.getElementById('successTitle');
        const sMsg = document.getElementById('successMessage');
        if (sTitle) sTitle.textContent = title;
        if (sMsg) sMsg.textContent = msg;
        if (successModal) successModal.classList.remove('hidden');
    }

    function closeModal(modal) { 
        if (modal) modal.classList.add('hidden'); 
    }

    // --- 2. GESTIONE CLICK SULLA LISTA (EVENT DELEGATION) ---
    const handleLessonActionsClick = (e) => {
        const btnEdit = e.target.closest('.btn-action-edit');
        if (btnEdit) {
            openEditModal(btnEdit.getAttribute('data-id'));
            return;
        }
        const btnDelete = e.target.closest('.btn-action-delete');
        if (btnDelete) {
            openDeleteModal(btnDelete.getAttribute('data-id'));
            return;
        }
        const btnRate = e.target.closest('.btn-action-rate');
        if (btnRate) {
            idToModify = btnRate.getAttribute('data-id');
            tutorIdToRate = btnRate.getAttribute('data-tutor');
            document.getElementById('ratingModal')?.classList.remove('hidden');
        }
    };

    if (myLessonsList) myLessonsList.addEventListener('click', handleLessonActionsClick);
    if (pastList) pastList.addEventListener('click', handleLessonActionsClick);

    // --- LOGICA APERTURA MODALI ---
    async function openEditModal(id) {
        const lesson = currentLessons.find(l => l.id == id);
        if (!lesson) return;

        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`<strong>Modifica bloccata.</strong><br>Mancano meno di 24 ore all'inizio della lezione.<br>Contatta il tutor: <strong>${escapeHtml(email)}</strong>`);
            return;
        }

        idToModify = id;
        document.getElementById('editLessonId').value = lesson.id;
        document.getElementById('editDate').value = lesson.date;
        document.getElementById('editTutorId').value = lesson.tutor_id;
        document.getElementById('editNotes').value = lesson.notes || '';
        
        let dur = String(lesson.duration || '60').replace(' min', '').trim();
        document.getElementById('editDuration').value = dur + " min";

        const subjInput = document.getElementById('editSubject');
        if (subjInput) subjInput.value = lesson.subject || '';

        await updateEditTimeSlots();
        
        const editTimeEl = document.getElementById('editTime');
        const currentStartTime = lesson.time_slot.split('-')[0].trim();
        if (editTimeEl) editTimeEl.value = currentStartTime;

        editModal.classList.remove('hidden');
    }

    async function updateEditTimeSlots() {
        const dateVal = document.getElementById('editDate').value;
        const editTimeEl = document.getElementById('editTime');
        const tutorId = document.getElementById('editTutorId').value;
        const currentAppId = document.getElementById('editLessonId').value;

        if (!dateVal || !tutorId || !editTimeEl) return;

        const selectedDate = new Date(dateVal);
        const dayOfWeek = selectedDate.getDay();
        
        const tutor = allTutors.find(t => t.id === tutorId);
        if (!tutor || !tutor.availability) return;

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
            editTimeEl.innerHTML = '<option value="">-- Tutor non disponibile --</option>';
            editTimeEl.disabled = true;
            return;
        }

        editTimeEl.innerHTML = '<option value="">Caricamento...</option>';
        
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
            const dur = parseInt(app.duration) || 60; 
            for (let i = 0; i < dur; i += 30) occupiedSet.add(start + i);
        });

        const availableOptions = [];
        validRanges.forEach(slot => {
            const [sStr, eStr] = slot.range.split('-');
            if (!sStr || !eStr) return;
            const startRange = timeToMin(sStr.trim());
            const endRange = timeToMin(eStr.trim());

            for (let t = startRange; t < endRange; t += 30) {
                if (!occupiedSet.has(t) && !occupiedSet.has(t + 30) && (t + 60 <= endRange)) {
                    let maxDur = 60;
                    if (!occupiedSet.has(t + 60) && (t + 90 <= endRange)) maxDur = 90;
                    availableOptions.push({ time: minToTime(t), maxDur: maxDur });
                }
            }
        });

        editTimeEl.innerHTML = '<option value="">-- Scegli Orario --</option>';
        if (availableOptions.length > 0) {
            availableOptions.sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
            availableOptions.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.time;
                opt.textContent = optData.time;
                opt.setAttribute('data-max-duration', optData.maxDur);
                editTimeEl.appendChild(opt);
            });
            editTimeEl.disabled = false;
        } else {
            editTimeEl.innerHTML = '<option value="">Tutto occupato</option>';
        }
    }

    const editDateInput = document.getElementById('editDate');
    if (editDateInput) editDateInput.addEventListener('change', updateEditTimeSlots);

    const editTimeSelect = document.getElementById('editTime');
    if (editTimeSelect) {
        editTimeSelect.addEventListener('change', () => {
            const selectedOpt = editTimeSelect.options[editTimeSelect.selectedIndex];
            if (!selectedOpt || !selectedOpt.value) return;
            const maxDur = selectedOpt.getAttribute('data-max-duration');
            const durSelect = document.getElementById('editDuration');
            const opt90 = durSelect.querySelector('option[value="90 min"]');
            if (maxDur === '60') {
                if (opt90) opt90.disabled = true;
                durSelect.value = "60 min";
            } else {
                if (opt90) opt90.disabled = false;
            }
        });
    }

    function openDeleteModal(id) {
        const lesson = currentLessons.find(l => l.id == id);
        if (!lesson) return;

        if (!check24Hours(lesson.date, lesson.time_slot)) {
            const email = getTutorEmail(lesson.tutor_id);
            showWarning(`<strong>Impossibile annullare.</strong><br>Mancano meno di 24 ore all'inizio.<br>Scrivi a: <strong>${escapeHtml(email)}</strong>`);
            return;
        }

        idToModify = id;
        deleteModal.classList.remove('hidden');
    }

    // --- 3. CARICAMENTO DATI TUTOR (UNIFICATO SUPABASE + BACKEND) ---
    async function loadTutors() {
        const tutorMap = new Map();
        try {
            const { data } = await sbClient.from('profiles').select('*').eq('role', 'tutor');
            if (data && Array.isArray(data)) {
                data.forEach(t => { if (t && t.id) tutorMap.set(t.id, t); });
            }
        } catch(e) { console.warn("Supabase tutors fetch:", e); }

        try {
            if (typeof FMT_API !== 'undefined') {
                const res = await FMT_API.getTutors();
                const list = Array.isArray(res) ? res : (res && res.tutors ? res.tutors : []);
                list.forEach(t => {
                    if (t && t.id && !tutorMap.has(t.id)) {
                        tutorMap.set(t.id, t);
                    }
                });
            }
        } catch(e) { console.warn("FMT_API tutors fetch:", e); }

        allTutors = Array.from(tutorMap.values());
    }
    await loadTutors();
    initMastercomBanner();

    // Se l'utente Mastercom ha già anno e scuola nel profilo, pre-impostiamo il Passo 1!
    if (fmtUser && fmtUser.class_year && fmtUser.school_type) {
        filterYear.value = String(fmtUser.class_year);
        filterSchoolType.value = fmtUser.school_type;
        syncQuickPills();
        updateSubjects();
    }

    // --- CARICAMENTO LEZIONI DELLO STUDENTE ---
    async function fetchLessons() {
        const upcomingList = document.getElementById('myLessonsList');
        const pastListEl = document.getElementById('pastLessonsList');
        const cancelledListEl = document.getElementById('cancelledLessonsList');
        if (upcomingList) upcomingList.innerHTML = '<div class="empty-state"><p><i class="fas fa-spinner fa-spin"></i> Caricamento lezioni...</p></div>';
        if (pastListEl) pastListEl.innerHTML = '';
        if (cancelledListEl) cancelledListEl.innerHTML = '';

        try {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - 30);
            const limitStr = limitDate.toISOString().split('T')[0];

            let data = [];
            let ratedIds = new Set();

            if (isMastercomUser) {
                const res = await FMT_API.getAppointments(user.id);
                data = Array.isArray(res) ? res : ((res && res.appointments) ? res.appointments : []);
            } else {
                const { data: sbData } = await sbClient.from('appointments').select('*').eq('user_id', user.id).order('date', {ascending:true});
                data = sbData || [];
                const { data: ratedData } = await sbClient.from('tutor_ratings').select('appointment_id');
                ratedIds = new Set(ratedData ? ratedData.map(r => r.appointment_id) : []);
            }

            // Check unnotified cancellations
            function checkCancellations(lessons) {
                if (!lessons) return;
                const unnotified = lessons.filter(l => l.status === 'Cancellata' && l.cancellation_notified === 0);
                if (unnotified.length > 0) {
                    let msg = '<strong>Attenzione! Le seguenti lezioni sono state annullate dal tutor:</strong><br><br>';
                    unnotified.forEach(l => {
                        msg += `• <strong>${escapeHtml(l.subject)}</strong> del ${escapeHtml(l.date)} alle ${escapeHtml(l.time_slot)}<br>`;
                        if (l.cancellation_reason) {
                            msg += `  Motivo: <em>${escapeHtml(l.cancellation_reason)}</em><br>`;
                        }
                    });
                    showWarning(msg);
                    
                    const baseUrl = (typeof FMT_API !== 'undefined') ? FMT_API.getBaseUrl() : '';
                    unnotified.forEach(l => {
                        fetch(`${baseUrl}/api/fmt/appointments/acknowledge_cancellation`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + (typeof FMT_API !== 'undefined' ? FMT_API.getToken() : '')
                            },
                            body: JSON.stringify({ appointment_id: l.id })
                        }).catch(console.error);
                    });
                }
            }

            checkCancellations(data);

            currentLessons = (data || []).filter(l => {
                if (l.status === 'Cancellata' && l.date < limitStr) return false;
                return true;
            });

            const todayStr = new Date().toISOString().split('T')[0];
            const activeLessonsCount = currentLessons.filter(l => l.status !== 'Cancellata' && l.date >= todayStr).length;
            const badgeEl = document.getElementById('myLessonsBadge');
            if (badgeEl) badgeEl.textContent = activeLessonsCount;

            upcomingList.innerHTML = '';
            if (pastListEl) pastListEl.innerHTML = '';
            if (cancelledListEl) cancelledListEl.innerHTML = '';

            let upcomingCount = 0;
            let pastCount = 0;
            let cancelledCount = 0;

            currentLessons.forEach(l => {
                const d = new Date(l.date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
                const isCancelled = l.status === 'Cancellata';
                const isPast = !isCancelled && l.date < todayStr;
                const isGroup = l.is_group;

                let roomInfo = '';
                const groupLabel = isGroup
                    ? `<span style="background:#1565C0; color:white; padding:3px 9px; border-radius:99px; font-size:0.68rem; font-weight:700; margin-bottom:6px; display:inline-flex; align-items:center; gap:5px;"><i class="fas fa-users"></i> LEZIONE DI GRUPPO</span>`
                    : '';
                if (!isCancelled) {
                    roomInfo = l.room_name 
                        ? `<div class="lesson-detail" style="color:#1565c0; font-weight:600;"><i class="fas fa-door-open"></i> Aula: ${escapeHtml(l.room_name)}</div>`
                        : `<div class="lesson-detail" style="color:#94a3b8; font-style:italic;"><i class="fas fa-door-closed"></i> Aula assegnata a breve</div>`;
                }

                const cancelReasonDisplay = isCancelled
                    ? `<div style="margin-top:10px; background:#fff; padding:10px 12px; border-radius:10px; border-left:4px solid #d32f2f; color:#c62828; font-size:0.84rem;">
                         <strong><i class="fas fa-ban"></i> Cancellata:</strong>
                         <span style="font-style:italic;">"${escapeHtml(l.cancellation_reason || 'Nessun motivo specificato')}"</span>
                       </div>`
                    : '';

                let buttonsDisplay = '';
                let statusText = l.status || 'Confermato';
                let statusStyle = isCancelled
                    ? 'background:#ffebee; color:#c62828;'
                    : 'background:#e8f5e9; color:#2e7d32;';

                if (isCancelled) {
                    buttonsDisplay = `<div style="text-align:right; font-size:0.78rem; color:#c62828; font-weight:700;">Annullata</div>`;
                } else if (isPast) {
                    statusText = "Conclusa";
                    statusStyle = "background:#f1f5f9; color:#475569;";
                    const alreadyRated = ratedIds.has(l.id);
                    buttonsDisplay = alreadyRated 
                        ? `<div style="text-align:right; color:#2e7d32; font-size:0.8rem; font-weight:700;"><i class="fas fa-check-circle"></i> Valutata</div>`
                        : `<div class="lesson-actions"><button class="btn-mini btn-action-rate" style="background:#fff8e1; color:#d97706; border:1px solid #fde68a;" data-id="${l.id}" data-tutor="${l.tutor_id}"><i class="fas fa-star"></i> Valuta</button></div>`;
                } else {
                    buttonsDisplay = `<div class="lesson-actions">
                        <button class="btn-mini edit btn-action-edit" data-id="${l.id}"><i class="fas fa-pen"></i> Modifica</button>
                        <button class="btn-mini delete btn-action-delete" data-id="${l.id}"><i class="fas fa-trash-alt"></i> Annulla</button>
                    </div>`;
                }

                const item = document.createElement('div');
                item.className = 'lesson-item';
                if (isCancelled) item.style.cssText = "border-left: 5px solid #d32f2f; background: #fff5f5;";
                else if (isGroup && !isPast) item.style.cssText = "border-left: 5px solid #1565C0; background: #f0f7ff;";
                if (isPast) item.style.cssText = "border-left: 5px solid #94a3b8; background: #f8fafc; opacity: 0.9;";

                item.innerHTML = `
                    <div style="flex:1; min-width:0;">
                        ${groupLabel}
                        <div class="lesson-header">
                            <h4 style="${(isCancelled || isPast) ? 'color:#64748b;' : ''} ${isCancelled ? 'text-decoration:line-through;' : ''}">${escapeHtml(l.subject)}</h4>
                            <span class="status-badge" style="${statusStyle}">${escapeHtml(statusText)}</span>
                        </div>
                        <div class="lesson-detail"><i class="fas fa-user-graduate"></i> Tutor: <strong>${escapeHtml(l.tutor_name_cache || 'Tutor')}</strong></div>
                        <div class="lesson-detail"><i class="far fa-calendar-alt"></i> ${escapeHtml(d)} &bull; <strong>${escapeHtml(l.time_slot)}</strong> (${escapeHtml(l.duration || '60 min')})</div>
                        
                        ${roomInfo}
                        ${isGroup && l.group_members ? (
                            l.group_members.startsWith("Organizzato da ") 
                            ? (() => {
                                const parts = l.group_members.replace("Organizzato da ", "").split(" | Altri: ");
                                return `<div class="lesson-detail" style="color:#1565C0;"><i class="fas fa-crown"></i> <strong>Organizzatore:</strong> ${escapeHtml(parts[0])}</div>
                                        ${parts[1] ? `<div class="lesson-detail" style="color:#64748b; font-size:0.8rem;"><i class="fas fa-users"></i> <strong>Partecipanti:</strong> ${escapeHtml(parts[1])}</div>` : ''}`;
                              })()
                            : `<div class="lesson-detail" style="color:#1565C0;"><i class="fas fa-crown"></i> <strong>Organizzatore:</strong> Tu</div>
                               <div class="lesson-detail" style="color:#64748b; font-size:0.8rem;"><i class="fas fa-users"></i> <strong>Partecipanti:</strong> ${escapeHtml(l.group_members)}</div>`
                        ) : ''}
                        ${cancelReasonDisplay}

                        ${l.notes && !isCancelled ? `<div class="lesson-detail" style="font-style:italic; margin-top:6px; color:#64748b;"><i class="far fa-comment-dots"></i> "${escapeHtml(l.notes)}"</div>` : ''}
                    </div>
                    ${buttonsDisplay}
                `;
                
                if (isCancelled) {
                    if (cancelledListEl) cancelledListEl.appendChild(item);
                    cancelledCount++;
                } else if (isPast) {
                    if (pastListEl) pastListEl.appendChild(item);
                    pastCount++;
                } else {
                    upcomingList.appendChild(item);
                    upcomingCount++;
                }
            });

            const pastBadge = document.getElementById('pastCountBadge');
            const cancelledBadge = document.getElementById('cancelledCountBadge');
            if (pastBadge) pastBadge.textContent = pastCount;
            if (cancelledBadge) cancelledBadge.textContent = cancelledCount;

            if (upcomingCount === 0) {
                upcomingList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon"><i class="fas fa-calendar-plus"></i></div>
                        <h4>Nessuna lezione in programma</h4>
                        <p>Usa il modulo a fianco per prenotare la tua prossima ripetizione!</p>
                    </div>`;
            }
            if (pastCount === 0 && pastListEl) {
                pastListEl.innerHTML = '<p class="empty-state-mini">Nessuna lezione conclusa negli ultimi 30 giorni.</p>';
            }
            if (cancelledCount === 0 && cancelledListEl) {
                cancelledListEl.innerHTML = '<p class="empty-state-mini">Nessuna lezione cancellata.</p>';
            }

        } catch(e) { console.error(e); }
    }

    // --- 4. GESTIONE MODALI (SALVA/ANNULLA/VOTA) ---
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const d = document.getElementById('editDate').value;
            const t = document.getElementById('editTime').value;
            const note = document.getElementById('editNotes').value;
            let dur = document.getElementById('editDuration').value;
            if (!dur.includes('min')) dur += " min";

            const subjInput = document.getElementById('editSubject');
            const subject = subjInput ? subjInput.value : null;

            const updateData = { date: d, time_slot: t, notes: note, duration: dur };
            if (subject) updateData.subject = subject;

            try {
                if (isMastercomUser) {
                    const res = await FMT_API.updateAppointment(idToModify, updateData);
                    if (res && res.success === false) throw new Error(res.message || "Errore aggiornamento lezione.");
                } else {
                    const { error } = await sbClient.from('appointments').update(updateData).eq('id', idToModify);
                    if (error) throw error;
                }
                closeModal(editModal);
                showSuccess("Lezione Aggiornata", "Le modifiche sono state salvate con successo.");
                fetchLessons();
            } catch(err) { showWarning("Errore: " + err.message); }
        });
    }

    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener('click', async () => {
            if (!idToModify) return;
            try {
                if (isMastercomUser) {
                    const res = await FMT_API.cancelAppointment(idToModify, 'Cancellata dallo studente');
                    if (res && res.success === false) throw new Error(res.message || "Errore durante la cancellazione.");
                    closeModal(deleteModal);
                    fetchLessons();
                    showSuccess("Lezione Annullata", "La tua prenotazione è stata cancellata.");
                } else {
                    const { error } = await sbClient.rpc('cancel_group_lesson', {
                        p_lesson_id: idToModify,
                        p_reason: 'Cancellata dallo studente'
                    });
                    if (error) throw error;
                    closeModal(deleteModal);
                    fetchLessons();
                    showSuccess("Lezione Annullata", "La lezione è stata annullata per tutti i partecipanti.");
                }
            } catch(err) {
                showWarning("Errore: " + err.message);
            }
        });
    }

    const btnCancelRating = document.getElementById('btnCancelRating');
    if (btnCancelRating) {
        btnCancelRating.onclick = () => document.getElementById('ratingModal').classList.add('hidden');
    }
    
    const btnSubmitRating = document.getElementById('btnSubmitRating');
    if (btnSubmitRating) {
        btnSubmitRating.onclick = async () => {
            const selectedStar = document.querySelector('input[name="stars"]:checked');
            if (!selectedStar) { showWarning("Seleziona da 1 a 5 stelle prima di inviare!"); return; }
            
            const ratingValue = parseInt(selectedStar.value);
            btnSubmitRating.disabled = true;
            btnSubmitRating.innerText = "Invio...";

            try {
                if (isMastercomUser) {
                    const res = await FMT_API.rateTutor(tutorIdToRate, idToModify, ratingValue);
                    if (res && res.success === false) throw new Error(res.message || "Errore invio recensione.");
                } else {
                    const { error } = await sbClient.from('tutor_ratings').insert([{
                        tutor_id: tutorIdToRate,
                        appointment_id: idToModify,
                        rating: ratingValue
                    }]);
                    if (error) throw error;
                }
                document.getElementById('ratingModal').classList.add('hidden');
                showSuccess("Grazie!", "La tua valutazione anonima è stata registrata.");
                fetchLessons();
            } catch(e) { showWarning("Errore: " + e.message); }
            finally { btnSubmitRating.disabled = false; btnSubmitRating.innerText = "Invia Voto"; }
        };
    }

    document.getElementById('btnCancelEdit')?.addEventListener('click', () => closeModal(editModal));
    document.getElementById('btnCancelDelete')?.addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('btnSuccessClose')?.addEventListener('click', () => closeModal(successModal));
    document.getElementById('btnWarningClose')?.addEventListener('click', () => closeModal(warningModal));

    // --- 5. LOGICA PRENOTAZIONE (COMPATIBILE CON NUOVO FORMATO CLASSI E LEGACY) ---

    // Verifica se una singola stringa di classe tutor (es. "4INFO", "5A", "3 ITT", "4 Liceo")
    // è idonea ad insegnare allo studente di anno `studentYear` (1..5) e indirizzo `studentSchoolType` ("ITT" / "Liceo")
    function canTutorClassTeach(tutorClassStr, studentYear, studentSchoolType) {
        if (!tutorClassStr) return false;
        const clean = tutorClassStr.trim();
        const sYearNum = parseInt(studentYear, 10);

        // 1. Formato SubjectsConfig (es. "4INFO", "3ELN", "5A", "2ITT")
        if (typeof SubjectsConfig !== 'undefined') {
            const parsed = SubjectsConfig.parseClass(clean);
            if (parsed) {
                // Stesso indirizzo e anno del tutor >= anno dello studente
                if (parsed.schoolType === studentSchoolType && parsed.year >= sYearNum) {
                    return true;
                }
                // Regola speciale: 5° Liceo può insegnare al biennio ITT (1° e 2° anno)
                if (parsed.schoolType === 'Liceo' && parsed.year === 5 && studentSchoolType === 'ITT' && sYearNum <= 2) {
                    return true;
                }
                return false;
            }
        }

        // 2. Formato Legacy (es. "3 ITT", "4 Liceo")
        const lowC = clean.toLowerCase();
        const matchesYear = lowC.startsWith(String(studentYear));
        const matchesType = studentSchoolType === "Liceo" ? lowC.includes("liceo") : !lowC.includes("liceo");
        return matchesYear && matchesType;
    }

    function updateSubjects() {
        const y = filterYear.value;
        const type = filterSchoolType.value;
        syncQuickPills();

        filterSubject.innerHTML = '<option value="">Seleziona materia...</option>';
        filterSubject.disabled = true;
        selectTutor.innerHTML = '<option value="">Seleziona prima la materia...</option>';
        selectTutor.disabled = true;
        renderTutorCards([]);
        resetDateAndTime();
        updateStepperAndSummary();

        if (!y || !type) return;

        const subjectSet = new Set();
        allTutors.forEach(t => {
            const classes = t.class_info ? t.class_info.split(' | ') : [];
            const subjectsList = t.subjects ? t.subjects.split(' | ') : [];
            
            classes.forEach((c, idx) => {
                const subGroup = subjectsList[idx] !== undefined ? subjectsList[idx] : (subjectsList[0] || '');
                if (canTutorClassTeach(c, y, type) && subGroup) {
                    subGroup.split(',').forEach(s => {
                        const cleanSub = s.trim();
                        if (cleanSub) subjectSet.add(cleanSub);
                    });
                }
            });
        });

        // Se l'utente ha materie da Mastercom, assicuriamoci che siano visibili se pertinenti
        if (subjectSet.size > 0) {
            filterSubject.disabled = false;
            const studentSubjects = (fmtUser && fmtUser.materie) ? fmtUser.materie : [];
            const sortedSubjects = Array.from(subjectSet).sort((a, b) => {
                const aInTimetable = studentSubjects.includes(a);
                const bInTimetable = studentSubjects.includes(b);
                if (aInTimetable && !bInTimetable) return -1;
                if (!aInTimetable && bInTimetable) return 1;
                return a.localeCompare(b, 'it');
            });

            sortedSubjects.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                const isTimetable = studentSubjects.includes(s);
                opt.textContent = isTimetable ? `${s} ⭐ (Dal tuo orario)` : s;
                filterSubject.appendChild(opt);
            });
        } else {
            filterSubject.innerHTML = '<option value="">Nessun tutor attivo per questo anno/indirizzo</option>';
        }
    }

    function renderTutorCards(tutorsList) {
        if (!tutorCardsContainer) return;
        if (!filterSubject.value) {
            tutorCardsContainer.innerHTML = `
                <div class="step-placeholder">
                    <i class="fas fa-user-graduate"></i>
                    <span>Seleziona una materia al Passo 1 per scoprire i tutor disponibili.</span>
                </div>`;
            return;
        }

        if (!tutorsList || tutorsList.length === 0) {
            tutorCardsContainer.innerHTML = `
                <div class="step-placeholder" style="border-color:#ffcdd2; background:#fff5f5; color:#c62828;">
                    <i class="fas fa-exclamation-circle" style="color:#d32f2f;"></i>
                    <span>Nessun tutor disponibile per questa materia al momento.</span>
                </div>`;
            return;
        }

        tutorCardsContainer.innerHTML = '';
        tutorsList.forEach((t, idx) => {
            const name = t.full_name || (t.email ? t.email.split('@')[0] : 'Tutor');
            const initials = name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || 'T';
            const classBadge = t.class_info ? t.class_info.split(' | ')[0] : 'Tutor';
            const availPreview = t.availability ? t.availability.split(',')[0].trim() : 'Orari flessibili';

            const card = document.createElement('div');
            card.className = 'tutor-card-option';
            card.style.animationDelay = `${idx * 0.05}s`;
            card.setAttribute('data-tutor-id', t.id);
            if (selectTutor.value === String(t.id)) card.classList.add('selected');

            card.innerHTML = `
                <div class="tutor-avatar-circle">${escapeHtml(initials)}</div>
                <div class="tutor-card-meta">
                    <div class="tutor-card-name">${escapeHtml(name)}</div>
                    <div class="tutor-card-sub">
                        <span><i class="fas fa-graduation-cap" style="color:var(--agnelli-red);"></i> ${escapeHtml(classBadge)}</span>
                        <span>&bull; ${escapeHtml(availPreview)}</span>
                    </div>
                </div>
                <div class="tutor-card-check"><i class="fas fa-check"></i></div>
            `;

            card.addEventListener('click', () => {
                selectTutor.value = t.id;
                selectTutor.dispatchEvent(new Event('change'));
            });

            tutorCardsContainer.appendChild(card);
        });
    }

    function filterTutors() {
        const y = filterYear.value;
        const s = filterSubject.value;
        const type = filterSchoolType.value;
        selectTutor.innerHTML = '<option value="">Seleziona un tutor...</option>';
        selectTutor.disabled = true;
        resetDateAndTime();

        if (!y || !s || !type) {
            renderTutorCards([]);
            updateStepperAndSummary();
            return;
        }

        const filtered = allTutors.filter(t => {
            const classes = t.class_info ? t.class_info.split(' | ') : [];
            const subjectsList = t.subjects ? t.subjects.split(' | ') : [];
            
            return classes.some((c, idx) => {
                const subGroup = (subjectsList[idx] !== undefined ? subjectsList[idx] : (subjectsList[0] || '')).toLowerCase();
                const subTokens = subGroup.split(',').map(x => x.trim());
                const matchesSubject = subTokens.includes(s.toLowerCase()) || subGroup.includes(s.toLowerCase());
                return canTutorClassTeach(c, y, type) && matchesSubject;
            });
        });

        renderTutorCards(filtered);

        if (filtered.length > 0) {
            selectTutor.disabled = false;
            filtered.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.full_name || (t.email ? t.email.split('@')[0] : 'Tutor');
                opt.setAttribute('data-avail', t.availability || ""); 
                selectTutor.appendChild(opt);
            });

            // Se c'è un solo tutor per quella materia, selezionalo automaticamente per risparmiare un click!
            if (filtered.length === 1) {
                selectTutor.value = filtered[0].id;
                selectTutor.dispatchEvent(new Event('change'));
            }
        } else {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "Nessun tutor trovato";
            selectTutor.appendChild(opt);
        }

        updateStepperAndSummary();
    }

    filterYear.addEventListener('change', updateSubjects);
    filterSchoolType.addEventListener('change', updateSubjects);
    filterSubject.addEventListener('change', filterTutors);

    selectTutor.addEventListener('change', () => {
        resetDateAndTime();

        // Sincronizza selezione sulle card visive
        document.querySelectorAll('.tutor-card-option').forEach(card => {
            card.classList.toggle('selected', card.getAttribute('data-tutor-id') === String(selectTutor.value));
        });

        const selectedOption = selectTutor.options[selectTutor.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            updateStepperAndSummary();
            return;
        }

        const rawAvail = selectedOption.getAttribute('data-avail');
        if (!rawAvail) {
            availDisplay.style.display = 'none';
            showWarning("Questo tutor non ha ancora impostato le sue fasce orarie settimanali.");
            updateStepperAndSummary();
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
                currentTutorAvailability.push({ dayIndex: DAY_MAP[dayName], range: timeRange, label: part });
            }
        });

        availText.innerHTML = parts.map(p => `<span class="avail-day-pill"><i class="far fa-clock"></i> ${escapeHtml(p.trim())}</span>`).join('');
        availDisplay.style.display = 'flex';
        dateInput.disabled = false;
        dateInput.min = new Date().toISOString().split('T')[0];

        updateStepperAndSummary();
    });

    dateInput.addEventListener('change', async () => {
        const dateVal = dateInput.value;
        if (!dateVal) {
            updateStepperAndSummary();
            return;
        }

        const selectedDate = new Date(dateVal);
        const dayOfWeek = selectedDate.getDay();
        
        const validRanges = currentTutorAvailability.filter(item => item.dayIndex === dayOfWeek);

        if (validRanges.length === 0) {
            dateError.style.display = 'block';
            timeSelect.innerHTML = '<option value="">-- Giorno non disponibile --</option>';
            timeSelect.disabled = true;
            if (timePillsWrapper) timePillsWrapper.classList.add('hidden');
            updateStepperAndSummary();
            return;
        }
        
        dateError.style.display = 'none';
        timeSelect.innerHTML = '<option value="">Verifica disponibilità...</option>';
        timeSelect.disabled = true;

        const tutorId = selectTutor.value;
        let existingApps = [];

        if (isMastercomUser) {
            const occRes = await FMT_API.getAppointments(null, tutorId, dateVal);
            const list = Array.isArray(occRes) ? occRes : (occRes && occRes.appointments ? occRes.appointments : []);
            existingApps = list.filter(a => a.status !== 'Cancellata');
        } else {
            const { data: sbExisting, error } = await sbClient
                .from('appointments')
                .select('time_slot, duration')
                .eq('tutor_id', tutorId)
                .eq('date', dateVal)
                .neq('status', 'Cancellata');
            if (!error) existingApps = sbExisting || [];
        }

        // Mappa Occupazione (Mattoncini da 30 min)
        const occupiedSet = new Set();
        existingApps.forEach(app => {
            const start = timeToMin(app.time_slot);
            const dur = parseInt(app.duration) || 60; 
            for (let i = 0; i < dur; i += 30) {
                occupiedSet.add(start + i);
            }
        });

        // Calcola Slot Disponibili
        const availableOptions = [];
        validRanges.forEach(slot => {
            const [sStr, eStr] = slot.range.split('-');
            if (!sStr || !eStr) return;
            const startRange = timeToMin(sStr.trim());
            const endRange = timeToMin(eStr.trim());

            for (let t = startRange; t < endRange; t += 30) {
                if (!occupiedSet.has(t) && !occupiedSet.has(t + 30) && (t + 60 <= endRange)) {
                    let maxDur = 60;
                    if (!occupiedSet.has(t + 60) && (t + 90 <= endRange)) {
                        maxDur = 90;
                    }
                    availableOptions.push({
                        time: minToTime(t),
                        maxDur: maxDur
                    });
                }
            }
        });

        timeSelect.innerHTML = '<option value="">-- Scegli Orario --</option>';
        if (timePillsGrid) timePillsGrid.innerHTML = '';

        if (availableOptions.length > 0) {
            availableOptions.sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
            
            availableOptions.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.time;
                opt.textContent = `${optData.time} (fino a ${optData.maxDur} min)`;
                opt.setAttribute('data-max-duration', optData.maxDur);
                timeSelect.appendChild(opt);

                if (timePillsGrid) {
                    const pill = document.createElement('button');
                    pill.type = 'button';
                    pill.className = 'time-pill-btn';
                    pill.setAttribute('data-time', optData.time);
                    pill.innerHTML = `<i class="far fa-clock"></i> <span>${optData.time}</span> <small>(${optData.maxDur === 90 ? '60/90m' : '60m'})</small>`;
                    pill.addEventListener('click', () => {
                        timeSelect.value = optData.time;
                        timeSelect.dispatchEvent(new Event('change'));
                    });
                    timePillsGrid.appendChild(pill);
                }
            });
            
            timeSelect.disabled = false;
            if (timePillsWrapper) timePillsWrapper.classList.remove('hidden');

            // Auto-seleziona il primo slot se ce n'è uno solo
            if (availableOptions.length === 1) {
                timeSelect.value = availableOptions[0].time;
                timeSelect.dispatchEvent(new Event('change'));
            }
        } else {
            timeSelect.innerHTML = '<option value="">Tutto occupato in questa data</option>';
            if (timePillsWrapper) timePillsWrapper.classList.add('hidden');
        }
        updateStepperAndSummary();
    });

    // LISTENER PER GESTIRE DURATA E SINCRONIZZARE PILLOLE ORARIE
    timeSelect.addEventListener('change', () => {
        const selectedOpt = timeSelect.options[timeSelect.selectedIndex];
        const val = timeSelect.value;

        document.querySelectorAll('.time-pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-time') === val);
        });

        if (selectedOpt && val) {
            const maxDur = selectedOpt.getAttribute('data-max-duration');
            const radio90 = document.getElementById('d90');
            const radio60 = document.getElementById('d60');
            const label90 = document.querySelector('label[for="d90"]');
            
            if (maxDur === '60') {
                radio90.disabled = true;
                if (label90) {
                    label90.style.opacity = "0.45";
                    label90.style.cursor = "not-allowed";
                    label90.title = "Non disponibile per questo orario (spazio massimo 60 min)";
                }
                radio60.checked = true;
            } else {
                radio90.disabled = false;
                if (label90) {
                    label90.style.opacity = "1";
                    label90.style.cursor = "pointer";
                    label90.title = "";
                }
            }
        }
        updateStepperAndSummary();
    });

    function resetDateAndTime() {
        dateInput.value = "";
        dateInput.disabled = true;
        dateError.style.display = 'none';
        timeSelect.innerHTML = '<option value="">-- Prima seleziona una data --</option>';
        timeSelect.disabled = true;
        if (timePillsWrapper) timePillsWrapper.classList.add('hidden');
        if (timePillsGrid) timePillsGrid.innerHTML = '';
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
        const submitBtn = document.getElementById('btnSubmitBooking');

        if (!tid || !sub || !date || !time) {
            showWarning("Completa tutti i passaggi (Materia, Tutor, Data e Orario) prima di confermare la prenotazione.");
            return;
        }

        const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Prenotazione in corso...</span>';
        }

        try {
            const tName = selectTutor.options[selectTutor.selectedIndex].text.split(' (')[0];
            const organizerName = user.user_metadata?.full_name || user.email;

            if (isMastercomUser) {
                const appPayload = {
                    user_id: user.id,
                    tutor_id: tid,
                    student_name: organizerName,
                    student_email: user.email,
                    subject: sub,
                    date: date,
                    time_slot: time,
                    duration: dur,
                    tutor_name_cache: tName,
                    notes: notes,
                    is_group: isGroupMode && selectedStudents.length > 0,
                    group_members: (isGroupMode && selectedStudents.length > 0)
                        ? `Organizzato da ${organizerName} | Altri: ${selectedStudents.map(s => s.name).join(', ')}`
                        : null
                };
                const res = await FMT_API.createAppointment(appPayload);
                if (res && res.success === false) throw new Error(res.message || "Errore durante la prenotazione.");
            } else if (isGroupMode && selectedStudents.length > 0) {
                const participantsData = selectedStudents.map(student => {
                    const sObj = allStudents.find(x => x.id === student.id);
                    const otherParticipants = selectedStudents.filter(s => s.id !== student.id).map(s => s.name);
                    const othersSuffix = otherParticipants.length > 0 ? ` | Altri: ${otherParticipants.join(', ')}` : '';
                    
                    return {
                        id: student.id,
                        name: student.name,
                        email: sObj ? sObj.email : "",
                        group_members: `Organizzato da ${organizerName}${othersSuffix}`
                    };
                });

                const { error } = await sbClient.rpc('book_group_lesson', {
                    p_tutor_id: tid,
                    p_subject: sub,
                    p_date: date,
                    p_time_slot: time,
                    p_duration: dur,
                    p_notes: notes,
                    p_tutor_name: tName,
                    p_organizer_name: organizerName,
                    p_organizer_email: user.email,
                    p_participants: participantsData
                });
                if (error) throw error;
            } else {
                const { error } = await sbClient.from('appointments').insert([{
                    user_id: user.id, 
                    tutor_id: tid, 
                    student_name: organizerName,
                    student_email: user.email, 
                    subject: sub, 
                    date: date, 
                    time_slot: time, 
                    duration: dur, 
                    status: 'Confermato', 
                    tutor_name_cache: tName, 
                    notes: notes,
                    is_group: false,
                    group_members: null
                }]);
                if (error) throw error;
            }
            
            showSuccess("Prenotata! 🎉", `La tua lezione di ${sub} con ${tName} è stata confermata.`);
            bookingForm.reset();
            selectedStudents = [];
            renderChips();
            resetDateAndTime();
            selectTutor.innerHTML = '<option value="">Seleziona...</option>';
            selectTutor.disabled = true;
            renderTutorCards([]);
            syncQuickPills();
            updateStepperAndSummary();
            fetchLessons();
        } catch(e) {
            showWarning(e.message || "Errore durante il salvataggio della prenotazione.");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnHtml;
            }
        }
    });

    // Avvio iniziale
    updateStepperAndSummary();
    fetchLessons();
});
})();
