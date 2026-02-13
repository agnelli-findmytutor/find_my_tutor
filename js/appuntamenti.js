// --- CONFIGURAZIONE ---
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabili Stato
let bookingIdToDelete = null; 
let lessonIdToCancel = null;  
let myFutureLessons = []; 

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- ELEMENTI DOM ---
    const roomBookingsList = document.getElementById('roomBookingsList');
    const bookingForm = document.getElementById('roomBookingForm');
    
    // Inputs Form
    const dateInput = document.getElementById('selectDate');
    const lessonLinkSelect = document.getElementById('selectLessonLink');
    const autoTimeSlotInput = document.getElementById('autoTimeSlot'); // Nuovo Input Nascosto

    // Modali & Pulsanti (Invariati)
    const deleteModal = document.getElementById('deleteModal');
    const cancelLessonModal = document.getElementById('cancelLessonModal');
    const successModal = document.getElementById('successModal');
    const warningModal = document.getElementById('warningModal');
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnSuccessClose = document.getElementById('btnSuccessClose');
    const btnWarningClose = document.getElementById('btnWarningClose');
    const btnAbortCancel = document.getElementById('btnAbortCancel');
    const btnExecCancel = document.getElementById('btnExecCancel');
    const successTitle = document.getElementById('successTitle');
    const successMessage = document.getElementById('successMessage');
    const warningTitle = document.getElementById('warningTitle');
    const warningMessage = document.getElementById('warningMessage');

    // --- SICUREZZA: ESCAPE HTML ---
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // --- UTILS ---
    function showSuccess(title, msg) {
        if(successTitle) successTitle.textContent = title;
        if(successMessage) successMessage.textContent = msg;
        if(successModal) successModal.classList.remove('hidden');
    }
    function showWarning(title, msg) {
        if(warningTitle) warningTitle.textContent = title;
        if(warningMessage) warningMessage.textContent = msg;
        if(warningModal) warningModal.classList.remove('hidden');
    }
    window.openDeleteModal = (id) => {
        bookingIdToDelete = id;
        if(deleteModal) deleteModal.classList.remove('hidden');
    };
    function closeModal(modal) { if(modal) modal.classList.add('hidden'); }

    // --- CHECK UTENTE ---
    const { data: { user }, error: userError } = await sbClient.auth.getUser();
    if (userError || !user) { window.location.href = "login.html"; return; }

    // Controllo Ruolo
    try {
        const { data: profile } = await sbClient.from('profiles').select('role').eq('id', user.id).single();
        const userRole = profile ? profile.role : 'studente';
        if (userRole !== 'tutor' && userRole !== 'admin') {
            alert("⛔ ACCESSO NEGATO: Pagina riservata ai Tutor.");
            window.location.href = "dashboard.html";
            return;
        }
    } catch (err) { console.error("Errore ruolo:", err); }

    // --- SETUP FORM AULA (MODIFICATO) ---
    
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
        dateInput.addEventListener('change', function() {
            if (!this.value) return;
            const dateObj = new Date(this.value);
            if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
                this.value = '';
                showWarning("Scuola Chiusa", "Non è possibile prenotare aule nel weekend.");
            } else {
                updateLessonLinkDropdown(); // Aggiorna lista lezioni basandosi SOLO sulla data
            }
        });
    }

    // Listener sul cambio lezione per salvare l'orario
    if(lessonLinkSelect) {
        lessonLinkSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const timeSlot = selectedOption.getAttribute('data-time'); // Recupera orario dall'attributo
            if(autoTimeSlotInput) autoTimeSlotInput.value = timeSlot || "";
        });
    }

    // --- CARICA LEZIONI FUTURE ---
    async function loadFutureLessons() {
        try {
            const todayISO = new Date().toISOString().split('T')[0];
            const { data } = await sbClient.from('appointments')
                .select('*')
                .eq('tutor_id', user.id)
                .eq('status', 'Confermato') // Carica solo le confermate
                .gte('date', todayISO); 
            
            myFutureLessons = data || [];
        } catch(e) { console.error("Err future lessons", e); }
    }
    await loadFutureLessons();

    // --- AGGIORNA MENU TENDINA (NUOVA LOGICA) ---
    function updateLessonLinkDropdown() {
        if(!lessonLinkSelect) return;
        const selectedDate = dateInput.value;
        
        lessonLinkSelect.innerHTML = '<option value="">-- Seleziona una lezione --</option>';
        lessonLinkSelect.disabled = true;
        lessonLinkSelect.style.backgroundColor = "#f5f5f5";
        lessonLinkSelect.style.cursor = "not-allowed";
        
        if(autoTimeSlotInput) autoTimeSlotInput.value = ""; // Reset orario

        if(!selectedDate) return;

        // Filtra solo per DATA
        const matchingLessons = myFutureLessons.filter(l => l.date === selectedDate);

        if(matchingLessons.length > 0) {
            lessonLinkSelect.disabled = false;
            lessonLinkSelect.style.cursor = "pointer";
            lessonLinkSelect.style.backgroundColor = "#e8f5e9"; 
            lessonLinkSelect.style.border = "2px solid #2e7d32";
            
            matchingLessons.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                // Mostra anche l'orario nel testo per chiarezza
                opt.textContent = `${l.time_slot} - ${l.student_name} (${l.subject})`;
                // Salviamo l'orario come attributo dati
                opt.setAttribute('data-time', l.time_slot); 
                lessonLinkSelect.appendChild(opt);
            });
        } else {
            lessonLinkSelect.innerHTML = '<option value="">Nessuna lezione in questa data</option>';
            lessonLinkSelect.style.backgroundColor = "#ffebee";
            lessonLinkSelect.style.border = "1px solid #c62828";
        }
    }

    // --- PRENOTA AULA SUBMIT ---
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = bookingForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            try {
                const room = document.getElementById('selectRoom').value;
                const dateVal = document.getElementById('selectDate').value;
                
                // Prendi l'orario dal campo nascosto (popolato automaticamente)
                const time = autoTimeSlotInput ? autoTimeSlotInput.value : null; 
                const linkedLessonId = lessonLinkSelect ? lessonLinkSelect.value : null;

                const checkDate = new Date(dateVal);
                if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
                    showWarning("Data non valida", "Hai selezionato un giorno nel weekend.");
                    return;
                }

                if (!linkedLessonId || !time) {
                    showWarning("Dati Mancanti", "Seleziona una lezione valida per associare l'orario.");
                    return;
                }

                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attendi...';
                btn.disabled = true;

                const options = { day: 'numeric', month: 'long' };
                const dateLabel = checkDate.toLocaleDateString('it-IT', options);

                // Inserimento prenotazione aula
                const { error: roomError } = await sbClient.from('room_bookings').insert([{ 
                    user_id: user.id, room_name: room, day_label: dateLabel, time_slot: time
                }]);
                if (roomError) throw roomError;

                // Aggiornamento lezione collegata
                const { error: updateError } = await sbClient.from('appointments')
                    .update({ room_name: room }).eq('id', linkedLessonId);
                if(updateError) console.error("Errore aggiornamento lezione:", updateError);

                showSuccess("Aula Prenotata!", `Hai prenotato ${room} per il ${dateLabel} (${time}).`);
                
                bookingForm.reset();
                if(lessonLinkSelect) {
                    lessonLinkSelect.innerHTML = '<option value="">-- Prima seleziona una data --</option>';
                    lessonLinkSelect.style.backgroundColor = "#f5f5f5";
                    lessonLinkSelect.disabled = true;
                }
                
                fetchRoomBookings(); 
                fetchAppointments();

            } catch (err) {
                showWarning("Errore", err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- LOGICHE CANCELLAZIONE (Invariate) ---
    if(btnCancelDelete) btnCancelDelete.addEventListener('click', () => { closeModal(deleteModal); bookingIdToDelete = null; });
    if(btnConfirmDelete) btnConfirmDelete.addEventListener('click', async () => {
        if (!bookingIdToDelete) return;
        const originalText = btnConfirmDelete.innerText;
        btnConfirmDelete.innerText = "Attendere...";
        try {
            const { error } = await sbClient.from('room_bookings').delete().eq('id', bookingIdToDelete);
            if (error) throw error;
            closeModal(deleteModal);
            showSuccess("Cancellata", "La prenotazione aula è stata rimossa.");
            fetchRoomBookings();
        } catch (err) { alert("Errore: " + err.message); } 
        finally { btnConfirmDelete.innerText = originalText; bookingIdToDelete = null; }
    });

    window.openCancelLessonModal = (id) => {
        lessonIdToCancel = id;
        document.getElementById('cancelReason').value = ""; 
        if(cancelLessonModal) cancelLessonModal.classList.remove('hidden');
    };

    if(btnAbortCancel) btnAbortCancel.addEventListener('click', () => { 
        closeModal(cancelLessonModal); 
        lessonIdToCancel = null; 
    });

    if(btnExecCancel) btnExecCancel.addEventListener('click', async () => {
        if(!lessonIdToCancel) return;
        const reason = document.getElementById('cancelReason').value.trim();
        if(reason.length < 5) {
            alert("Motivo obbligatorio (min 5 caratteri)."); return;
        }
        const originalText = btnExecCancel.innerText;
        btnExecCancel.innerText = "Processing...";
        btnExecCancel.disabled = true;
        try {
            const { error } = await sbClient.rpc('cancel_group_lesson', {
                p_lesson_id: lessonIdToCancel,
                p_reason: reason
            });
            if(error) throw error;
            closeModal(cancelLessonModal);
            showSuccess("Lezione Cancellata", "Status aggiornato per tutto il gruppo.");
            fetchAppointments(); 
        } catch(err) { alert("Errore: " + err.message); } 
        finally { btnExecCancel.innerText = originalText; btnExecCancel.disabled = false; lessonIdToCancel = null; }
    });

    if(btnSuccessClose) btnSuccessClose.addEventListener('click', () => closeModal(successModal));
    if(btnWarningClose) btnWarningClose.addEventListener('click', () => closeModal(warningModal));

    // --- FETCH DATI (Invariati) ---
    fetchRoomBookings();
    fetchAppointments();

    async function fetchRoomBookings() {
        if (!roomBookingsList) return;
        roomBookingsList.innerHTML = '<p>Caricamento...</p>';
        try {
            const { data, error } = await sbClient.from('room_bookings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) throw error;
            roomBookingsList.innerHTML = '';
            if (!data || data.length === 0) {
                roomBookingsList.innerHTML = `<p style="color:#888;">Nessuna aula prenotata.</p>`;
                return;
            }
            data.forEach(booking => {
                const card = document.createElement('div');
                card.className = 'room-card';
                card.innerHTML = `
                    <div class="room-info">
                        <h4>${booking.room_name}</h4>
                        <p><i class="far fa-calendar-alt"></i> ${booking.day_label}</p>
                        <p><i class="far fa-clock"></i> ${booking.time_slot}</p>
                    </div>
                    <button class="btn-delete-booking" onclick="window.openDeleteModal('${booking.id}')"><i class="fas fa-trash-alt"></i></button>
                `;
                roomBookingsList.appendChild(card);
            });
        } catch (err) { console.error(err); roomBookingsList.innerHTML = '<p>Errore Aule.</p>'; }
    }

    async function fetchAppointments() {
        const upcomingList = document.getElementById('upcomingList');
        if(!upcomingList) return;
        
        upcomingList.innerHTML = '<p>Caricamento agenda...</p>';
        
        try {
            const { data, error } = await sbClient.from('appointments').select('*').eq('tutor_id', user.id).order('date', { ascending: true });
            if (error) throw error;
            processAppointments(data);
        } catch (err) { console.error(err); upcomingList.innerHTML = `<p style="color:red">Errore: ${err.message}</p>`; }
    }

    function processAppointments(appointments) {
        const todayObj = new Date();
        const today = todayObj.toISOString().split('T')[0];
        
        // Data limite (30 giorni fa) per nascondere le vecchie cancellazioni
        const limitDate = new Date();
        limitDate.setDate(todayObj.getDate() - 30);
        const limitStr = limitDate.toISOString().split('T')[0];
        
        // Raggruppamento lezioni di gruppo per il Tutor (Logica migliorata senza duplicati)
        const groupedMap = new Map();
        const processedApps = [];

        appointments.forEach(app => {
            if (app.is_group) {
                const key = `${app.date}_${app.time_slot}_${app.status}`;
                if (groupedMap.has(key)) {
                    const existing = groupedMap.get(key);
                    if (!existing.all_students.includes(app.student_name)) {
                        existing.all_students.push(app.student_name);
                    }
                    // Se questa riga specifica l'organizzatore, salviamolo
                    if (app.group_members && app.group_members.startsWith("Organizzato da ")) {
                        existing.organizer_name = app.group_members.replace("Organizzato da ", "").split(" | ")[0];
                    }
                } else {
                    const copy = { ...app };
                    copy.all_students = [app.student_name];
                    copy.organizer_name = (app.group_members && app.group_members.startsWith("Organizzato da ")) 
                        ? app.group_members.replace("Organizzato da ", "").split(" | ")[0] 
                        : app.student_name;
                    groupedMap.set(key, copy);
                    processedApps.push(copy);
                }
            } else {
                processedApps.push(app);
            }
        });

        const upcoming = [];
        const past = [];
        const cancelled = [];

        processedApps.forEach(app => {
            if (app.status === 'Cancellata') {
                if (app.date >= limitStr) cancelled.push(app);
            } else if (app.date >= today) {
                upcoming.push(app);
            } else {
                past.push(app);
            }
        });

        // Renderizza le liste
        renderList(document.getElementById('upcomingList'), upcoming, 'Nessuna lezione in programma.');
        renderList(document.getElementById('pastList'), past.reverse(), 'Nessuna lezione passata.'); // Reverse per vedere le più recenti prima
        renderList(document.getElementById('cancelledList'), cancelled.reverse(), 'Nessuna lezione cancellata.');

        // --- GESTIONE AVVISO CANCELLAZIONI (NOVITÀ) ---
        checkNewCancellations(cancelled);
    }

    function checkNewCancellations(cancelledLessons) {
        const alertBox = document.getElementById('cancellationAlert');
        if (!alertBox || cancelledLessons.length === 0) return;

        // Recupera ID già visti dal LocalStorage
        const seenIds = JSON.parse(localStorage.getItem('fmt_seen_cancellations') || '[]');
        
        // Filtra solo quelle NON viste
        const newCancellations = cancelledLessons.filter(l => !seenIds.includes(l.id));

        if (newCancellations.length > 0) {
            let html = `
                <div class="alert-header">
                    <i class="fas fa-bell"></i> Attenzione: Lezioni Cancellate
                </div>
                <p style="margin:5px 0 10px; font-size:0.9rem; color:#555;">Alcune lezioni sono state annullate recentemente:</p>
            `;
            
            newCancellations.forEach(l => {
                html += `
                    <div class="alert-item">
                        <strong>${l.date} - ${l.time_slot}</strong> con ${escapeHtml(l.student_name)}<br>
                        <span style="font-size:0.85rem; color:#b71c1c;">Motivo: ${escapeHtml(l.cancellation_reason || 'N/D')}</span>
                    </div>
                `;
            });

            html += `<button id="btnDismissAlert" class="btn-dismiss">Ho capito</button>`;
            alertBox.innerHTML = html;
            alertBox.classList.remove('hidden');

            // Listener per il tasto "Ho capito"
            document.getElementById('btnDismissAlert').addEventListener('click', () => {
                // Aggiungi i nuovi ID ai visti
                const updatedSeen = [...seenIds, ...newCancellations.map(l => l.id)];
                localStorage.setItem('fmt_seen_cancellations', JSON.stringify(updatedSeen));
                alertBox.classList.add('hidden');
            });
        }
    }

    function renderList(container, apps, emptyMsg) {
        container.innerHTML = '';
        if (!apps || apps.length === 0) {
            container.innerHTML = `<div class="empty-calendar"><p>${emptyMsg}</p></div>`;
            return;
        }

        const groups = {};
        apps.forEach(app => { if (!groups[app.date]) groups[app.date] = []; groups[app.date].push(app); });
        
        Object.keys(groups).sort().forEach(dateStr => {
            const dayApps = groups[dateStr];
            const dateObj = new Date(dateStr);
            const dateLabel = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            const daySection = document.createElement('div');
            daySection.className = 'day-section';
            
            let html = `<div class="day-header">${dateLabel}</div>`;
            
            dayApps.forEach(app => {
                const isCancelled = app.status === 'Cancellata';
                const statusClass = isCancelled ? 'cancelled' : 'active';
                const isGroup = app.is_group;
                
                let cardStyle = '';
                if (isGroup && !isCancelled) cardStyle = 'border-left: 4px solid #1565C0; background: #E3F2FD;';
                
                const roomBadge = !isCancelled && app.room_name 
                    ? `<span class="room-badge"><i class="fas fa-door-open"></i> ${escapeHtml(app.room_name)}</span>` 
                    : '';
                
                const deleteButtonArea = !isCancelled 
                    ? `<div class="card-actions"><button onclick="window.openCancelLessonModal('${app.id}')" class="btn-cancel-lesson"><i class="fas fa-times-circle"></i> Cancella</button></div>`
                    : `<div class="card-status-text">LEZIONE ANNULLATA</div>`;
                
                const notesHtml = app.notes ? `<div class="lesson-notes"><i class="far fa-comment-dots"></i> ${escapeHtml(app.notes)}</div>` : '';

                const groupBadge = app.is_group 
                    ? `<span style="background:#E3F2FD; color:#1565C0; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:5px;">GRUPPO</span>` 
                    : '';
                
                const studentInfo = isGroup 
                    ? `<p class="student-name" style="color:#1565C0;"><i class="fas fa-crown"></i> <strong>Org:</strong> ${escapeHtml(app.organizer_name)}</p>
                       <p style="font-size:0.8rem; color:#666; margin-top:2px;"><i class="fas fa-users"></i> <strong>Altri:</strong> ${app.all_students.filter(n => n !== app.organizer_name).map(escapeHtml).join(', ') || 'Nessuno'}</p>`
                    : `<p class="student-name"><i class="fas fa-user-graduate"></i> ${escapeHtml(app.student_name)}</p>`;

                html += `<div class="lesson-card ${statusClass}" style="${cardStyle}">
                        <div class="card-content">
                            <div class="card-main">
                                <div class="time-display">${app.time_slot}</div>
                                <div class="info-display">
                                    <h4>${escapeHtml(app.subject || 'Materia')} ${roomBadge} ${groupBadge}</h4>
                                    ${studentInfo}
                                    ${notesHtml}
                                </div>
                            </div>
                        </div>
                        ${deleteButtonArea}
                    </div>`;
            });
            daySection.innerHTML = html;
            container.appendChild(daySection);
        });
    }
});

// --- FUNZIONE GLOBALE TABS ---
window.switchTab = (tabName) => {
    // Nascondi tutti i contenuti
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Disattiva tutti i bottoni
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // Attiva corrente
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Trova il bottone cliccato (hack veloce basato sull'ordine o testo, ma meglio event.target se passato)
    // Qui usiamo un selettore semplice basato sull'onclick
    const btn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(btn) btn.classList.add('active');
};