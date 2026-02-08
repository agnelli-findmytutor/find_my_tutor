// --- CONFIGURAZIONE ---
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 

const FIXED_HOURS = ["14:30 - 15:30", "15:30 - 16:30", "16:30 - 17:30"];
const sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabili Stato
let bookingIdToDelete = null; // Per cancellare Aula (fisicamente)
let lessonIdToCancel = null;  // Per cancellare Lezione (logicamente - status 'Cancellata')
let myFutureLessons = []; 

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- ELEMENTI DOM ---
    const roomBookingsList = document.getElementById('roomBookingsList');
    const appointmentsList = document.getElementById('appointmentsList');
    const bookingForm = document.getElementById('roomBookingForm');
    
    // Inputs Form
    const timeSelect = document.getElementById('selectTime'); 
    const dateInput = document.getElementById('selectDate');
    const lessonLinkSelect = document.getElementById('selectLessonLink');

    // Modali
    const deleteModal = document.getElementById('deleteModal') || document.getElementById('confirmModal'); // Per Aule
    const cancelLessonModal = document.getElementById('cancelLessonModal'); // Per Lezioni
    const successModal = document.getElementById('successModal');
    const warningModal = document.getElementById('warningModal');

    // Pulsanti Modali
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    const btnSuccessClose = document.getElementById('btnSuccessClose');
    const btnWarningClose = document.getElementById('btnWarningClose');

    // Pulsanti Modale Lezione
    const btnAbortCancel = document.getElementById('btnAbortCancel');
    const btnExecCancel = document.getElementById('btnExecCancel');
    
    // Testi
    const successTitle = document.getElementById('successTitle');
    const successMessage = document.getElementById('successMessage');
    const warningTitle = document.getElementById('warningTitle');
    const warningMessage = document.getElementById('warningMessage');

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

    // --- SETUP FORM AULA ---
    
    if (timeSelect) {
        timeSelect.addEventListener('change', updateLessonLinkDropdown);
        timeSelect.addEventListener('input', updateLessonLinkDropdown);
    }

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
                updateLessonLinkDropdown();
            }
        });
    }

    // --- CARICA LEZIONI FUTURE ---
    async function loadFutureLessons() {
        try {
            const todayISO = new Date().toISOString().split('T')[0];
            const { data } = await sbClient.from('appointments')
                .select('*')
                .eq('tutor_id', user.id)
                .gte('date', todayISO); 
            
            myFutureLessons = data || [];
        } catch(e) { console.error("Err future lessons", e); }
    }
    await loadFutureLessons();

    // --- AGGIORNA MENU TENDINA ---
    function updateLessonLinkDropdown() {
        if(!lessonLinkSelect) return;
        const selectedDate = dateInput.value;
        const selectedTime = timeSelect.value;
        
        lessonLinkSelect.innerHTML = '<option value="">-- Seleziona Data e Ora --</option>';
        lessonLinkSelect.disabled = true;

        if(!selectedDate || !selectedTime) return;

        const matchingLessons = myFutureLessons.filter(l => l.date === selectedDate && l.time_slot === selectedTime);

        if(matchingLessons.length > 0) {
            lessonLinkSelect.disabled = false;
            lessonLinkSelect.innerHTML = '<option value="" selected disabled>-- Seleziona la lezione (OBBLIGATORIO) --</option>';
            matchingLessons.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = `Lezione con ${l.student_name} (${l.subject})`;
                lessonLinkSelect.appendChild(opt);
            });
            lessonLinkSelect.style.backgroundColor = "#e8f5e9"; 
            lessonLinkSelect.style.border = "2px solid #2e7d32";
        } else {
            lessonLinkSelect.innerHTML = '<option value="">Nessuna lezione trovata in questo orario</option>';
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
                const time = document.getElementById('selectTime').value;
                const linkedLessonId = lessonLinkSelect ? lessonLinkSelect.value : null;

                const checkDate = new Date(dateVal);
                if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
                    showWarning("Data non valida", "Hai selezionato un giorno nel weekend.");
                    return;
                }

                if (!linkedLessonId) {
                    showWarning("Azione Bloccata", "È OBBLIGATORIO collegare una lezione per prenotare l'aula.");
                    return;
                }

                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attendi...';
                btn.disabled = true;

                const options = { day: 'numeric', month: 'long' };
                const dateLabel = checkDate.toLocaleDateString('it-IT', options);

                const { error: roomError } = await sbClient.from('room_bookings').insert([{ 
                    user_id: user.id, room_name: room, day_label: dateLabel, time_slot: time
                }]);
                if (roomError) throw roomError;

                const { error: updateError } = await sbClient.from('appointments')
                    .update({ room_name: room }).eq('id', linkedLessonId);
                if(updateError) console.error("Errore aggiornamento lezione:", updateError);

                showSuccess("Aula Prenotata!", `Hai prenotato ${room} per il ${dateLabel}.`);
                
                bookingForm.reset();
                if(lessonLinkSelect) {
                    lessonLinkSelect.innerHTML = '<option value="">Imposta data/ora...</option>';
                    lessonLinkSelect.style.backgroundColor = "";
                    lessonLinkSelect.style.border = "";
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

    // --- LOGICA CANCELLAZIONE AULA (Questa USA .delete() perché l'aula si rimuove fisicamente) ---
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

    // --- LOGICA CANCELLAZIONE LEZIONE (Questa USA .update() per non farla sparire) ---
    window.openCancelLessonModal = (id) => {
        lessonIdToCancel = id;
        document.getElementById('cancelReason').value = ""; // Reset campo motivo
        if(cancelLessonModal) cancelLessonModal.classList.remove('hidden');
    };

    if(btnAbortCancel) btnAbortCancel.addEventListener('click', () => { 
        closeModal(cancelLessonModal); 
        lessonIdToCancel = null; 
    });

    if(btnExecCancel) btnExecCancel.addEventListener('click', async () => {
        if(!lessonIdToCancel) return;

        const reason = document.getElementById('cancelReason').value.trim();
        
        // CONTROLLO OBBLIGATORIO MOTIVO
        if(reason.length < 5) {
            alert("Devi specificare un motivo valido (minimo 5 caratteri) per cancellare la lezione.");
            return;
        }

        const originalText = btnExecCancel.innerText;
        btnExecCancel.innerText = "Cancellazione in corso...";
        btnExecCancel.disabled = true;

        try {
            // *** PUNTO CRUCIALE: Usiamo .update() ***
            // La lezione rimane nel database, ma lo stato diventa 'Cancellata'
            const { error } = await sbClient.from('appointments')
                .update({ 
                    status: 'Cancellata', 
                    cancellation_reason: reason 
                })
                .eq('id', lessonIdToCancel);

            if(error) throw error;

            closeModal(cancelLessonModal);
            showSuccess("Lezione Cancellata", "La lezione è stata annullata ma rimarrà visibile nello storico.");
            
            // Ricarica la lista per mostrare la card rossa
            fetchAppointments(); 

        } catch(err) {
            console.error(err);
            alert("Errore durante l'aggiornamento: " + err.message);
        } finally {
            btnExecCancel.innerText = originalText;
            btnExecCancel.disabled = false;
            lessonIdToCancel = null;
        }
    });

    // Chiusura Modali Generici
    if(btnSuccessClose) btnSuccessClose.addEventListener('click', () => closeModal(successModal));
    if(btnWarningClose) btnWarningClose.addEventListener('click', () => closeModal(warningModal));


    // --- FETCH DATI ---
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
                    <button class="btn-delete-booking" onclick="window.openDeleteModal(${booking.id})"><i class="fas fa-trash-alt"></i></button>
                `;
                roomBookingsList.appendChild(card);
            });
        } catch (err) { console.error(err); roomBookingsList.innerHTML = '<p>Errore Aule.</p>'; }
    }

    async function fetchAppointments() {
        if(!appointmentsList) return;
        appointmentsList.innerHTML = '<p>Caricamento agenda...</p>';
        try {
            const { data, error } = await sbClient
                .from('appointments')
                .select('*')
                .eq('tutor_id', user.id) 
                .order('date', { ascending: true });

            if (error) throw error;
            renderCalendar(data);
        } catch (err) {
            console.error(err);
            appointmentsList.innerHTML = `<p style="color:red">Errore: ${err.message}</p>`;
        }
    }

    function renderCalendar(appointments) {
        appointmentsList.innerHTML = '';
        if (!appointments || appointments.length === 0) {
            appointmentsList.innerHTML = `
                <div class="empty-calendar" style="text-align:center; color:#999; padding:20px;">
                    <i class="far fa-calendar-check" style="font-size:2rem; margin-bottom:10px;"></i>
                    <p>Nessuna lezione in programma.</p>
                </div>`;
            return;
        }

        const groups = {};
        appointments.forEach(app => {
            if (!groups[app.date]) groups[app.date] = [];
            groups[app.date].push(app);
        });

        Object.keys(groups).sort().forEach(dateStr => {
            const apps = groups[dateStr];
            const dateObj = new Date(dateStr);
            const dateLabel = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            
            const daySection = document.createElement('div');
            let html = `<div class="day-header" style="margin-top:25px; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:15px; color:#D32F2F; font-weight:700; text-transform:capitalize;">${dateLabel}</div>`;
            
            apps.forEach(app => {
                // VERIFICA STATO CANCELLATO
                const isCancelled = app.status === 'Cancellata';

                // STILI DINAMICI
                let cardStyle = "background:white; padding:20px; border-radius:12px; border-left:5px solid #D32F2F; margin-bottom:15px; box-shadow:0 4px 10px rgba(0,0,0,0.05); position:relative;";
                let titleStyle = "margin:0; font-size:1.1rem; color:#333;";
                let statusColor = app.status === 'Confermato' ? 'green' : '#555';

                // Se cancellata, cambia stile in rosso
                if (isCancelled) {
                    cardStyle = "background:#fff5f5; padding:20px; border-radius:12px; border-left:5px solid #b71c1c; margin-bottom:15px; opacity:0.9;";
                    titleStyle = "margin:0; font-size:1.1rem; color:#999; text-decoration:line-through;";
                    statusColor = "#b71c1c";
                }
                
                const notesDisplay = app.notes && !isCancelled
                    ? `<div style="margin-top:8px; font-size:0.85rem; color:#555; background:#f9f9f9; padding:8px; border-radius:6px; border-left:3px solid #ccc;">
                         <strong><i class="far fa-comment-dots"></i> Argomenti:</strong> ${app.notes}
                       </div>` 
                    : '';
                
                // NUOVO: MOSTRA MOTIVO CANCELLAZIONE
                const cancelReasonDisplay = isCancelled
                    ? `<div style="margin-top:10px; font-size:0.85rem; color:#b71c1c; background:#ffcdd2; padding:10px; border-radius:6px;">
                         <strong><i class="fas fa-ban"></i> MOTIVO CANCELLAZIONE:</strong><br>
                         ${app.cancellation_reason || 'Nessun motivo specificato'}
                       </div>`
                    : '';
                
                const emailDisplay = app.student_email
                    ? `<a href="mailto:${app.student_email}" style="color:#555; text-decoration:none;">${app.student_email}</a>`
                    : '<span style="color:#999; font-style:italic;">Email non disponibile</span>';

                const roomBadge = !isCancelled && app.room_name 
                    ? `<span style="background:#E3F2FD; color:#1565c0; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold; margin-left:10px;">
                         <i class="fas fa-door-open"></i> ${app.room_name}
                       </span>` 
                    : (isCancelled ? '' : `<span style="color:#999; font-size:0.8rem; margin-left:10px; font-style:italic;">Aula non assegnata</span>`);

                // NUOVO: Nascondi il tasto cancella se è già cancellata
                const deleteButtonArea = !isCancelled 
                    ? `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee; text-align: right;">
                         <button onclick="window.openCancelLessonModal('${app.id}')" 
                            style="background: #ffebee; color: #d32f2f; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-times-circle"></i> Cancella Lezione
                         </button>
                       </div>`
                    : `<div style="margin-top: 10px; text-align: right; color: #b71c1c; font-weight: bold; font-size: 0.8rem;">
                            LEZIONE ANNULLATA
                       </div>`;

                html += `
                    <div class="lesson-card" style="${cardStyle}">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="flex:1;">
                                <h4 style="${titleStyle}">
                                    ${app.subject || 'Materia'}
                                    ${roomBadge}
                                </h4>
                                
                                <p style="margin:5px 0 0; color:#666; font-size:0.9rem;">
                                    <i class="fas fa-user-graduate" style="width:20px; color:#D32F2F;"></i> 
                                    <strong>${app.student_name || 'Studente'}</strong>
                                </p>
                                
                                <p style="margin:2px 0 0; color:#666; font-size:0.9rem;">
                                    <i class="fas fa-envelope" style="width:20px; color:#D32F2F;"></i> 
                                    ${emailDisplay}
                                </p>

                                ${notesDisplay}
                                ${cancelReasonDisplay}
                            </div>

                            <div style="text-align:right; margin-left:15px;">
                                <div style="font-weight:700; font-size:1.1rem; color:#333;">${app.time_slot}</div>
                                <div style="font-size:0.85rem; color:#666;">${app.duration || '60 min'}</div>
                                <div style="font-size:0.8rem; color:${statusColor}; margin-top:4px; font-weight:600; text-transform:uppercase;">${app.status || 'Attivo'}</div>
                            </div>
                        </div>

                        ${deleteButtonArea}
                    </div>`;
            });
            daySection.innerHTML = html;
            appointmentsList.appendChild(daySection);
        });
    }
});