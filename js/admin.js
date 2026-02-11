(function() {
// PROTEZIONE DI LIVELLO 1: Nasconde immediatamente l'interfaccia.
// Impedisce il "flash" del contenuto prima del controllo del ruolo.
// Se l'utente non è admin, la pagina rimarrà bianca fino al reindirizzamento.
document.documentElement.style.display = 'none';

// --- CONFIGURAZIONE ---
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabili Stato
let currentLessons = [];
let allCancelledLessons = [];
let allUsers = []; 
let allPendingRequests = [];
let allHistoryRequests = [];
let activeBannedIds = new Set(); // Traccia gli ID degli utenti sospesi
let selectedId = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. CHECK SICUREZZA
    const { data: { user }, error: authError } = await sb.auth.getUser();
    
    // Se non c'è sessione, reindirizza immediatamente
    if (authError || !user) {
        window.location.replace("login.html");
        return;
    }

    // Verifica il ruolo direttamente sul database (Senza usare cache)
    const { data: profile, error: profileError } = await sb.from('profiles').select('role').eq('id', user.id).single();
    
    if (profileError || !profile || profile.role !== 'admin') {
        // Pulizia aggressiva: se hanno provato a manomettere il localStorage, lo svuotiamo
        localStorage.removeItem('fmt_role');
        localStorage.removeItem('fmt_avatar');
        // Reindirizzamento forzato
        window.location.replace("dashboard.html");
        return;
    }

    // SOLO SE L'UTENTE È ADMIN: rendiamo visibile la pagina
    document.documentElement.style.display = 'block';

    // 2. LOAD DATA
    loadStats();
    loadTutorRequests(); 
    loadRequestsHistory();
    loadUsers();
    loadBookings(); 
    loadAllAppointments(); 
    loadCancelledLessons();
    loadBanHistory(); // Carica lo storico dei ban
    loadActiveBans();  // Carica i ban attivi

    // --- SETUP MODALI ---
    const editModal = document.getElementById('adminEditModal');
    const cancelModal = document.getElementById('adminCancelModal');
    const permDeleteModal = document.getElementById('adminDeletePermanentModal');
    const userDetailModal = document.getElementById('adminUserDetailModal');

    // Chiusura Modali
    document.getElementById('btnCancelEdit').onclick = () => editModal.classList.add('hidden');
    document.getElementById('btnAbortCancel').onclick = () => cancelModal.classList.add('hidden');
    document.getElementById('btnAbortPerm').onclick = () => permDeleteModal.classList.add('hidden');
    
    if(document.getElementById('btnCancelUserEdit')) {
        document.getElementById('btnCancelUserEdit').onclick = () => userDetailModal.classList.add('hidden');
    }

    // --- SALVATAGGIO MODALI LEZIONI ---
    document.getElementById('adminEditForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newData = {
            date: document.getElementById('editDate').value,
            time_slot: document.getElementById('editTime').value,
            status: document.getElementById('editStatus').value,
            room_name: document.getElementById('editRoom').value,
            notes: document.getElementById('editNotes').value
        };
        const { error } = await sb.from('appointments').update(newData).eq('id', selectedId);
        if(error) alert("Errore: " + error.message);
        else { editModal.classList.add('hidden'); loadAllAppointments(); loadCancelledLessons(); alert("Salvato."); }
    });

    document.getElementById('btnExecCancel').addEventListener('click', async () => {
        const reason = document.getElementById('adminCancelReason').value;
        if(!reason) { alert("Motivo obbligatorio."); return; }
        const { error } = await sb.from('appointments').update({ status: 'Cancellata', cancellation_reason: reason }).eq('id', selectedId);
        if(error) alert(error.message);
        else { cancelModal.classList.add('hidden'); loadAllAppointments(); loadCancelledLessons(); alert("Annullata."); }
    });

    document.getElementById('btnExecPerm').addEventListener('click', async () => {
        const { error } = await sb.from('appointments').delete().eq('id', selectedId);
        if(error) alert(error.message);
        else { permDeleteModal.classList.add('hidden'); loadAllAppointments(); loadCancelledLessons(); alert("Eliminata."); }
    });

    // --- SALVATAGGIO DETTAGLI UTENTE ---
    document.getElementById('adminUserDetailForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const uid = document.getElementById('editUserId').value;
        const updates = {
            class_info: document.getElementById('editUserClass').value,
            subjects: document.getElementById('editUserSubjects').value,
            availability: document.getElementById('editUserAvail').value // Prende la stringa generata
        };
        const { error } = await sb.from('profiles').update(updates).eq('id', uid);
        if(error) alert("Errore: " + error.message);
        else {
            document.getElementById('adminUserDetailModal').classList.add('hidden');
            loadUsers();
            alert("Profilo aggiornato!");
        }
    });
});

// --- FUNZIONI DI CARICAMENTO ---

async function loadStats() {
    const { count: uCount } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    document.getElementById('countUsers').innerText = uCount || 0;
    const { count: tCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor');
    document.getElementById('countTutors').innerText = tCount || 0;
    const { count: reqCount } = await sb.from('tutor_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    document.getElementById('countRequests').innerText = reqCount || 0;
    const { count: lCount } = await sb.from('appointments').select('*', { count: 'exact', head: true });
    document.getElementById('countLessons').innerText = lCount || 0;
    const { count: rCount } = await sb.from('room_bookings').select('*', { count: 'exact', head: true });
    document.getElementById('countRooms').innerText = rCount || 0;
}

// UTENTI
async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">Caricamento...</td></tr>';
    const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Errore</td></tr>`; return; }
    
    allUsers = users; 
    tbody.innerHTML = '';

    users.forEach(u => {
        const isBanned = activeBannedIds.has(u.id);
        const bannedBadge = isBanned ? `<span style="background:#ffebee; color:#c62828; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:5px; border:1px solid #ffcdd2;"><i class="fas fa-user-slash"></i> SOSPESO</span>` : '';
        
        const banBtn = `<button class="btn-action" style="background:#c62828; margin-left:5px;" onclick="openBanModal('${u.id}', '${u.role}')" title="Banna Utente"><i class="fas fa-ban"></i></button>`;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${u.email}</strong> ${bannedBadge}<br>
                <small>${u.full_name || 'Nessun nome'}</small><br>
                <small style="color:#666;">Classe: ${u.class_info || 'N.D.'}</small>
            </td>
            <td><span class="badge-role role-${u.role}">${u.role}</span></td>
            <td>
                <select class="role-select" id="role-${u.id}">
                    <option value="studente" ${u.role === 'studente' ? 'selected' : ''}>Studente</option>
                    <option value="tutor" ${u.role === 'tutor' ? 'selected' : ''}>Tutor</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="btn-action btn-save" onclick="updateUserRole('${u.id}')" title="Salva Ruolo"><i class="fas fa-save"></i></button>
                <button class="btn-action" style="background:#1565c0;" onclick="openUserProfile('${u.id}')" title="Modifica Dettagli"><i class="fas fa-user-edit"></i></button>
                ${banBtn}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- NUOVO: LOGICA DISPONIBILITÀ (Blocchetti) ---
window.addAvailabilitySlot = () => {
    const day = document.getElementById('tempDay').value;
    const start = document.getElementById('tempStart').value;
    const end = document.getElementById('tempEnd').value;

    if(!start || !end) { alert("Inserisci orario inizio e fine"); return; }
    if(start >= end) { alert("L'ora di fine deve essere dopo l'inizio"); return; }

    // VALIDAZIONE RIGOROSA (Come in diventa_tutor)
    const getMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const startMin = getMinutes(start);
    const endMin = getMinutes(end);
    const diff = endMin - startMin;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);

    if (sM % 15 !== 0 || eM % 15 !== 0) {
        alert("Gli orari devono essere a quarti d'ora (00, 15, 30, 45)."); return;
    }
    if (startMin < 885 || endMin > 1080) { // 14:45 - 18:00
        alert("Orario deve essere tra 14:45 e 18:00."); return;
    }
    // Blocchi validi (multipli di 30 min)
    if (![60, 90, 120, 150, 180].includes(diff)) {
        alert("Durata non valida (blocchi da 30 min richiesti)."); return;
    }

    const container = document.getElementById('slotsContainer');
    
    // Crea il blocchetto visivo (CHIP)
    const chip = document.createElement('div');
    chip.className = 'avail-chip';
    chip.style = "background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7; padding:5px 10px; border-radius:15px; font-size:0.85rem; display:flex; align-items:center; gap:5px;";
    
    // Testo: Lunedì 14:00 - 16:00
    chip.innerHTML = `<span><b>${day}</b> ${start} - ${end}</span>`;
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-times';
    icon.style = "cursor:pointer; margin-left:5px; color:#c62828;";
    icon.onclick = () => { chip.remove(); updateAvailString(); };
    chip.appendChild(icon);
    
    container.appendChild(chip);
    updateAvailString(); // Aggiorna input finale
    
    // Reset campi temporanei
    document.getElementById('tempStart').value = '';
    document.getElementById('tempEnd').value = '';
};

// Legge tutti i blocchetti e riempie l'input finale
window.updateAvailString = () => {
    const chips = document.querySelectorAll('#slotsContainer .avail-chip span');
    let parts = [];
    chips.forEach(c => parts.push(c.innerText));
    
    // Unisce con virgola
    document.getElementById('editUserAvail').value = parts.join(', ');
};

// Apre il modale e carica i dati esistenti
window.openUserProfile = (id) => {
    const user = allUsers.find(u => u.id === id);
    if(!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserClass').value = user.class_info || '';
    document.getElementById('editUserSubjects').value = user.subjects || '';
    
    // Pulisci il costruttore
    document.getElementById('slotsContainer').innerHTML = '';
    document.getElementById('tempStart').value = '';
    document.getElementById('tempEnd').value = '';
    
    // Se c'è già una disponibilità salvata (testo), mettiamola nel campo finale
    // Nota: Non possiamo facilmente ritrasformare il testo in blocchetti se è stato scritto a mano in passato,
    // quindi mostriamo il testo attuale nel campo finale. Se l'admin aggiunge blocchetti, si aggiungeranno/sovrascriveranno.
    document.getElementById('editUserAvail').value = user.availability || '';

    // Se la disponibilità attuale contiene virgole, proviamo a creare dei "finti" blocchetti per visualizzarli
    // Questo è un tentativo di parsing base per rendere l'interfaccia coerente
    if(user.availability && user.availability.includes('-')) {
        const parts = user.availability.split(',');
        const container = document.getElementById('slotsContainer');
        parts.forEach(p => {
            if(p.trim() === '') return;
            const chip = document.createElement('div');
            chip.className = 'avail-chip';
            chip.style = "background:#e0e0e0; color:#333; border:1px solid #ccc; padding:5px 10px; border-radius:15px; font-size:0.85rem; display:flex; align-items:center; gap:5px;";
            
            chip.innerHTML = `<span>${p.trim()}</span>`;
            const icon = document.createElement('i');
            icon.className = 'fas fa-times';
            icon.style = "cursor:pointer; margin-left:5px;";
            icon.onclick = () => { chip.remove(); updateAvailString(); };
            chip.appendChild(icon);
            container.appendChild(chip);
        });
    }

    document.getElementById('adminUserDetailModal').classList.remove('hidden');
};

window.updateUserRole = async (userId) => {
    const newRole = document.getElementById(`role-${userId}`).value;
    if(!confirm(`Cambiare ruolo in "${newRole}"?`)) return;
    
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    
    if (error) {
        alert("Errore: " + error.message);
    } else {
        alert("Ruolo aggiornato con successo!");
        
        // Se l'admin ha cambiato il PROPRIO ruolo, dobbiamo aggiornare la cache e ricaricare
        const { data: { user } } = await sb.auth.getUser();
        if (user && user.id === userId) {
            localStorage.setItem('fmt_role', newRole);
            window.location.reload();
        } else {
            loadUsers();
        }
    }
};

// --- CANDIDATURE ---
window.loadTutorRequests = async function() {
    const tbody = document.querySelector('#requestsTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">...</td></tr>';
    const { data: requests, error } = await sb.from('tutor_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Errore</td></tr>`; return; }
    tbody.innerHTML = '';
    allPendingRequests = requests || [];
    if (!requests || requests.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessuna candidatura.</td></tr>'; return; }
    requests.forEach(req => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${req.full_name}</strong><br><small>${req.email}</small></td><td><span class="badge-info">${req.class_info}</span><br><small>${req.subjects}</small></td><td><small>${req.availability}</small></td><td><div style="display:flex; gap:5px;"><button class="btn-action" style="background:#0288d1;" onclick="viewRequestDetails(${req.id}, 'pending')" title="Vedi Dettagli"><i class="fas fa-eye"></i></button><button class="btn-action btn-save" onclick="processRequest(${req.id}, '${req.email}', 'approved')"><i class="fas fa-check"></i></button><button class="btn-action btn-delete" onclick="processRequest(${req.id}, '${req.email}', 'rejected')"><i class="fas fa-times"></i></button></div></td>`;
        tbody.appendChild(row);
    });
}
// ... (Il resto delle funzioni di storico, aule e lezioni rimane identico a prima, non serve modificarle) ...
// Per brevità, assicurati che loadRequestsHistory, loadBookings, loadAllAppointments ecc siano presenti.
// Copia le funzioni "mancanti" dal file precedente se necessario, qui sotto ne rimetto le essenziali:

window.loadRequestsHistory = async function() {
    const tbody = document.querySelector('#requestsHistoryTable tbody');
    if(!tbody) return; 
    tbody.innerHTML = '<tr><td colspan="4">...</td></tr>';
    const { data, error } = await sb.from('tutor_requests').select('*').neq('status', 'pending').order('created_at', { ascending: false });
    if (error) return; 
    tbody.innerHTML = '';
    allHistoryRequests = data || [];
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessuno storico.</td></tr>'; return; }
    data.forEach(req => {
        const isApp = req.status === 'approved';
        const badge = isApp ? `<span style="background:#e8f5e9; color:#2e7d32; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">APPROVATA</span>` : `<span style="background:#ffebee; color:#c62828; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">RIFIUTATA</span>`;
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${req.full_name}</strong><br><small>${req.email}</small></td><td>${badge}</td><td><small>${new Date(req.created_at).toLocaleDateString()}</small></td><td><div style="display:flex; gap:5px;"><button class="btn-action" style="background:#0288d1;" onclick="viewRequestDetails(${req.id}, 'history')" title="Vedi Dettagli"><i class="fas fa-eye"></i></button><button class="btn-action btn-delete" onclick="deleteRequest(${req.id})"><i class="fas fa-trash"></i></button></div></td>`;
        tbody.appendChild(row);
    });
}

// --- AZIONI CANDIDATURE (APPROVA / RIFIUTA) ---
window.processRequest = async (reqId, email, action) => {
    let reason = null;

    // 1. GESTIONE CONFERMA / MOTIVO
    if (action === 'approved') {
        if (!confirm("Vuoi APPROVARE questo tutor?\nI suoi dati (materie, orari, classe) verranno pubblicati.")) return;
    } else {
        reason = prompt("Inserisci il motivo del rifiuto:");
        if (reason === null) return; 
        if (reason.trim() === "") reason = "Nessun motivo specificato.";
    }

    try {
        // 2. RECUPERA I DATI DELLA RICHIESTA (Serve per copiare materie/orari)
        // Dobbiamo leggere cosa ha scritto l'utente nel form
        const { data: requestData, error: fetchError } = await sb
            .from('tutor_requests')
            .select('*')
            .eq('id', reqId)
            .single();

        if (fetchError) throw fetchError;

        // 3. AGGIORNA LO STATO DELLA RICHIESTA (Approved/Rejected)
        const updateData = { status: action };
        if (reason) updateData.rejection_reason = reason;

        const { error: updateReqError } = await sb
            .from('tutor_requests')
            .update(updateData)
            .eq('id', reqId);

        if (updateReqError) throw updateReqError;

        // 4. SE APPROVATO -> TRASFERISCI I DATI NEL PROFILO PUBBLICO
        if (action === 'approved') {
            // Usiamo l'ID utente dalla richiesta per trovare il profilo giusto
            const userId = requestData.user_id; 

            if (userId) {
                const { error: profileError } = await sb
                    .from('profiles')
                    .update({ 
                        role: 'tutor', // Diventa Tutor
                        full_name: requestData.full_name, // Copia il nome nel profilo pubblico
                        class_info: requestData.class_info, // Copia Classe
                        subjects: requestData.subjects,     // Copia Materie
                        availability: requestData.availability // Copia ORARI (Fondamentale!)
                    })
                    .eq('id', userId);

                if (profileError) throw profileError;
                
                alert(`Candidatura approvata! ${email} è ora un Tutor visibile nelle prenotazioni.`);
            } else {
                // Fallback se per qualche motivo user_id è nullo (caso raro)
                alert("Attenzione: Richiesta approvata ma ID utente non trovato. Controllare database.");
            }
        } else {
            alert("Candidatura rifiutata.");
        }

        // 5. RICARICA LE TABELLE
        loadStats(); 
        loadTutorRequests(); 
        loadRequestsHistory(); 
        loadUsers();

    } catch (err) {
        console.error(err);
        alert("Errore durante l'operazione: " + err.message);
    }
};

window.deleteRequest = async (reqId) => {
    if(!confirm("Eliminare definitivamente?")) return;
    const { error } = await sb.from('tutor_requests').delete().eq('id', reqId);
    if(error) alert(error.message); else { alert("Eliminata."); loadRequestsHistory(); }
};

async function loadBookings() {
    const tbody = document.querySelector('#bookingsTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">...</td></tr>';
    
    // 1. Scarica le prenotazioni
    const { data: bookings, error } = await sb.from('room_bookings').select('*').order('created_at', { ascending: false });
    
    if(error) { console.error(error); tbody.innerHTML = '<tr><td colspan="4">Errore caricamento.</td></tr>'; return; }
    
    tbody.innerHTML = '';
    if(!bookings || bookings.length===0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Nessuna aula prenotata.</td></tr>'; return;}

    // 2. Scarica le email degli utenti coinvolti
    const userIds = [...new Set(bookings.map(b => b.user_id))];
    const { data: profiles } = await sb.from('profiles').select('id, email').in('id', userIds);
    const emailMap = {};
    if(profiles) profiles.forEach(p => emailMap[p.id] = p.email);

    bookings.forEach(b => {
        const email = emailMap[b.user_id] || 'Utente sconosciuto';
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${b.room_name}</strong></td><td>${b.day_label} <br> ${b.time_slot}</td><td>${email}</td><td><button class="btn-action btn-delete" onclick="deleteBooking('${b.id}')">Cancella</button></td>`;
        tbody.appendChild(row);
    });
}

// --- GESTIONE TABS ---
window.openTab = (evt, tabName) => {
    // Nascondi tutti i contenuti
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
        tabContents[i].classList.remove("active");
    }
    // Rimuovi active dai bottoni
    const tabLinks = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].className = tabLinks[i].className.replace(" active", "");
    }
    // Mostra tab corrente
    document.getElementById("tab-" + tabName).style.display = "block";
    setTimeout(() => document.getElementById("tab-" + tabName).classList.add("active"), 10);
    evt.currentTarget.className += " active";
};

window.deleteBooking = async (bookingId) => {
    if(!confirm("Cancellare?")) return;
    const { error } = await sb.from('room_bookings').delete().eq('id', bookingId);
    if (error) alert("Errore"); else { alert("Cancellata."); loadBookings(); }
};

async function loadAllAppointments() {
    const list = document.getElementById('adminAppointmentsList');
    list.innerHTML = '<p style="text-align:center;">Caricamento...</p>';
    const { data, error } = await sb.from('appointments').select('*').neq('status', 'Cancellata').order('date', { ascending: false });
    if(error) { list.innerHTML = "Errore."; return; }
    currentLessons = data; 
    renderLessons(list, data, false);
}

async function loadCancelledLessons() {
    const list = document.getElementById('adminCancelledList');
    list.innerHTML = '<p style="text-align:center;">Caricamento...</p>';
    const { data, error } = await sb.from('appointments').select('*').eq('status', 'Cancellata').order('date', { ascending: false });
    if(error) { list.innerHTML = "Errore."; return; }
    allCancelledLessons = data || [];
    renderLessons(list, data, true);
}

function renderLessons(container, data, isReg) {
    container.innerHTML = '';
    if(!data || data.length === 0) { container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Nessuna lezione.</p>'; return; }
    data.forEach(app => {
        const isCan = app.status === 'Cancellata';
        const d = new Date(app.date).toLocaleDateString();
        let style = isCan ? "background:#fff5f5; border-left:5px solid #d32f2f; opacity:0.9;" : "background:white; border-left:5px solid #1565C0;";
        if(isReg) style += " border: 1px solid #d32f2f;";
        
        const badge = app.room_name ? `<span style="background:#E3F2FD; color:#1565c0; padding:2px 6px; border-radius:4px; font-size:0.8rem;">📍 ${app.room_name}</span>` : `<span style="color:#999; font-size:0.8rem;">(No Aula)</span>`;
        const reason = isCan ? `<div style="margin-top:5px; color:#b71c1c; background:#ffcdd2; padding:5px; border-radius:4px; font-size:0.85rem;"><strong>Motivo:</strong> ${app.cancellation_reason}</div>` : '';
        const tutor = isReg ? `<div style="color:#d32f2f; font-weight:bold;">Tutor: ${app.tutor_name_cache}</div>` : `<strong>Tutor:</strong> ${app.tutor_name_cache || app.tutor_id}`;

        const div = document.createElement('div');
        div.className = 'lesson-card';
        div.style = `${style} padding:15px; margin-bottom:10px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div style="flex:1;">
                    <h4 style="margin:0; color:#333;">${app.subject} ${badge}</h4>
                    ${isReg ? tutor : `<p style="margin:5px 0; font-size:0.9rem; color:#666;">${tutor}</p>`}
                    <p style="margin:0; font-size:0.9rem; color:#555;"><strong>Studente:</strong> ${app.student_name} <br> ${d} - ${app.time_slot}</p>
                    ${reason}
                </div>
                <div style="text-align:right; display:flex; flex-direction:column; gap:5px;">
                    <span style="font-weight:bold; font-size:0.8rem; color:${isCan?'red':'green'}">${app.status}</span>
                    <button class="btn-mini" style="background:#E3F2FD; color:#1565c0;" onclick="openEdit('${app.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-mini" style="background:#FFF3E0; color:#E65100;" onclick="openCancel('${app.id}')"><i class="fas fa-ban"></i></button>
                    <button class="btn-mini" style="background:#FFEBEE; color:#b71c1c;" onclick="openPermDelete('${app.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        container.appendChild(div);
    });
}

// --- FUNZIONI GLOBALI PER I PULSANTI LEZIONI ---
window.openEdit = (id) => {
    // Cerca la lezione in entrambe le liste (attive e cancellate)
    const lesson = [...currentLessons, ...allCancelledLessons].find(l => l.id == id);
    if (!lesson) return;

    selectedId = id;
    
    // Popola i campi del modale con i dati esistenti
    const dateEl = document.getElementById('editDate');
    const timeEl = document.getElementById('editTime');
    const statusEl = document.getElementById('editStatus');
    const roomEl = document.getElementById('editRoom');
    const notesEl = document.getElementById('editNotes');

    if(dateEl) dateEl.value = lesson.date;
    if(timeEl) timeEl.value = lesson.time_slot;
    if(statusEl) statusEl.value = lesson.status;
    if(roomEl) roomEl.value = lesson.room_name || '';
    if(notesEl) notesEl.value = lesson.notes || '';

    document.getElementById('adminEditModal').classList.remove('hidden');
};

window.openCancel = (id) => {
    selectedId = id;
    document.getElementById('adminCancelReason').value = ''; // Reset campo motivo
    document.getElementById('adminCancelModal').classList.remove('hidden');
};

window.openPermDelete = (id) => {
    selectedId = id;
    document.getElementById('adminDeletePermanentModal').classList.remove('hidden');
};

// --- VISUALIZZA DETTAGLI CANDIDATURA (POP-UP) ---
window.viewRequestDetails = (id, type) => {
    const source = type === 'pending' ? allPendingRequests : allHistoryRequests;
    const req = source.find(r => r.id === id);
    if(!req) return;
    
    // Crea il modale se non esiste
    let modal = document.getElementById('requestDetailModal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'requestDetailModal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-card" style="text-align:left; max-width:500px;">
                <div class="modal-icon" style="background:#E1F5FE; color:#0288d1;"><i class="fas fa-info-circle"></i></div>
                <h3 style="text-align:center; margin-bottom:20px; color:#333;">Dettagli Candidatura</h3>
                <div id="reqDetailContent" style="font-size:0.95rem; line-height:1.6; color:#444;"></div>
                <div class="modal-actions">
                    <button class="btn-modal secondary" onclick="document.getElementById('requestDetailModal').classList.add('hidden')">Chiudi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const content = document.getElementById('reqDetailContent');
    content.innerHTML = `
        <p><strong><i class="fas fa-user"></i> Nome:</strong> ${req.full_name}</p>
        <p><strong><i class="fas fa-envelope"></i> Email:</strong> ${req.email}</p>
        <p><strong><i class="fas fa-phone"></i> Telefono:</strong> ${req.phone || 'N/A'}</p>
        <p><strong><i class="fas fa-school"></i> Classe:</strong> ${req.class_info}</p>
        <hr style="margin:15px 0; border:0; border-top:1px solid #eee;">
        <p><strong><i class="fas fa-book"></i> Materie:</strong><br><span style="background:#f5f5f5; padding:2px 6px; border-radius:4px;">${req.subjects}</span></p>
        <p style="margin-top:10px;"><strong><i class="far fa-clock"></i> Disponibilità:</strong><br>${req.availability}</p>
    `;
    
    modal.classList.remove('hidden');
};

// --- BANNA TUTOR ---
window.openBanModal = (id, role) => {
    selectedId = id;
    // Crea il modale dinamicamente se non esiste
    if(!document.getElementById('adminBanModal')) {
        const m = document.createElement('div');
        m.id = 'adminBanModal';
        m.className = 'modal-overlay hidden';
        m.innerHTML = `
            <div class="modal-card">
                <div class="modal-icon warning" style="background:#FFEBEE; color:#c62828;"><i class="fas fa-ban"></i></div>
                <h3 style="color:#c62828;">Banna Tutor</h3>
                <p id="banModalDesc">Seleziona il tipo di restrizione:</p>
                
                <select id="banType" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:15px;">
                    <option value="degrade">Solo Degrada a Studente (Tutor)</option>
                    <option value="24">Sospendi Account (24 Ore)</option>
                    <option value="168">Sospendi Account (7 Giorni)</option>
                    <option value="720">Sospendi Account (30 Giorni)</option>
                    <option value="permanent">Ban Permanente (Accesso Negato)</option>
                </select>

                <textarea id="banReason" rows="3" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; margin-bottom:15px;" placeholder="Motivo del ban..."></textarea>
                <div class="modal-actions">
                    <button class="btn-modal secondary" onclick="document.getElementById('adminBanModal').classList.add('hidden')">Annulla</button>
                    <button class="btn-modal danger" onclick="confirmBan()">Conferma Ban</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
    }

    // Personalizza descrizione in base al ruolo
    const desc = document.getElementById('banModalDesc');
    const typeSelect = document.getElementById('banType');
    if (role !== 'tutor') {
        typeSelect.options[0].disabled = true;
        typeSelect.value = "24";
        desc.innerText = "L'utente verrà sospeso dal sistema. Seleziona la durata:";
    } else {
        typeSelect.options[0].disabled = false;
        typeSelect.value = "degrade";
        desc.innerText = "Il tutor può essere degradato o sospeso. Seleziona la durata:";
    }

    document.getElementById('banReason').value = '';
    document.getElementById('adminBanModal').classList.remove('hidden');
};

window.confirmBan = async () => {
    const reason = document.getElementById('banReason').value;
    const banType = document.getElementById('banType').value;
    if(!reason) { alert("Inserisci un motivo."); return; }
    
    try {
        // 1. Gestione Ban a livello Authentication (se richiesto)
        if (banType !== 'degrade') {
            const hours = banType === 'permanent' ? -1 : parseInt(banType);
            const { error: authErr } = await sb.rpc('admin_manage_ban', { 
                target_user_id: selectedId, 
                ban_hours: hours 
            });
            if (authErr) throw authErr;
        }

        // 2. Se è un tutor, degrada a Studente e logga
        const user = allUsers.find(u => u.id === selectedId);
        if (user && user.role === 'tutor') {
            await sb.from('profiles').update({ role: 'studente' }).eq('id', selectedId);
            await sb.from('banned_tutors_log').insert([{ user_id: selectedId, reason: reason }]);
        }

        alert("Operazione completata con successo.");
    } catch (err) {
        alert("Errore durante il ban: " + err.message);
    }
    
    document.getElementById('adminBanModal').classList.add('hidden');
    loadUsers();
    loadBanHistory(); // Aggiorna la lista
};

// --- REVOCA BAN ---
window.revokeBan = async (userId) => {
    if(!confirm("Vuoi revocare la sospensione per questo utente? Potrà accedere immediatamente.")) return;
    
    try {
        // Chiamiamo la funzione esistente con 0 ore per rimuovere il ban
        const { error } = await sb.rpc('admin_manage_ban', { 
            target_user_id: userId, 
            ban_hours: 0 
        });
        
        if (error) throw error;
        
        alert("Sospensione revocata con successo.");
        loadActiveBans();
        loadUsers();
    } catch (err) {
        alert("Errore durante la revoca: " + err.message);
    }
};

// --- CARICA BAN ATTIVI ---
async function loadActiveBans() {
    const tbody = document.querySelector('#activeBansTable tbody');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4">Caricamento...</td></tr>';

    try {
        const { data: bans, error } = await sb.rpc('get_active_bans');
        if (error) throw error;

        tbody.innerHTML = '';
        activeBannedIds.clear();

        if (!bans || bans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Nessun utente attualmente sospeso.</td></tr>';
            loadUsers(); // Aggiorna i badge nella lista utenti
            return;
        }

        bans.forEach(b => {
            activeBannedIds.add(b.user_id);
            const until = new Date(b.banned_until).toLocaleDateString() + ' ' + new Date(b.banned_until).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${b.full_name || 'N/A'}</strong><br><small>${b.email}</small></td>
                <td><span style="color:#c62828; font-weight:bold;">${until}</span></td>
                <td><small>${b.reason || 'Nessun motivo specificato'}</small></td>
                <td><button class="btn-action" style="background:#2e7d32;" onclick="revokeBan('${b.user_id}')" title="Revoca Ban"><i class="fas fa-user-check"></i> Revoca</button></td>
            `;
            tbody.appendChild(row);
        });

        loadUsers(); // Aggiorna i badge nella lista utenti
    } catch (err) {
        console.error("Errore caricamento ban attivi:", err);
        tbody.innerHTML = '<tr><td colspan="4">Errore caricamento.</td></tr>';
    }
}

// --- STORICO BAN ---
async function loadBanHistory() {
    const tbody = document.querySelector('#banHistoryTable tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4">Caricamento...</td></tr>';
    
    // 1. Scarica i log (senza join per evitare errori FK)
    const { data: logs, error } = await sb
        .from('banned_tutors_log')
        .select('*')
        .order('created_at', { ascending: false });

    if(error) { console.error("Errore ban history:", error); tbody.innerHTML = '<tr><td colspan="4">Errore caricamento.</td></tr>'; return; }

    tbody.innerHTML = '';
    if(!logs || logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Nessun ban registrato.</td></tr>'; return; }

    // 2. Recupera i profili manualmente usando gli ID trovati
    const userIds = logs.map(l => l.user_id);
    const { data: profiles } = await sb.from('profiles').select('id, email, full_name').in('id', userIds);
    
    const profileMap = {};
    if(profiles) profiles.forEach(p => profileMap[p.id] = p);

    logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleDateString() + ' ' + new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const profile = profileMap[log.user_id] || {};
        const email = profile.email || 'Utente non trovato';
        const name = profile.full_name || 'N/A';
        
        const status = log.seen ? '<span style="color:#2e7d32; font-weight:bold; background:#e8f5e9; padding:2px 6px; border-radius:4px;">Visto</span>' : '<span style="color:#e65100; font-weight:bold; background:#fff3e0; padding:2px 6px; border-radius:4px;">Non letto</span>';

        const row = document.createElement('tr');
        row.innerHTML = `<td><small>${date}</small></td><td><strong>${name}</strong><br><small>${email}</small></td><td>${log.reason}</td><td>${status}</td>`;
        tbody.appendChild(row);
    });
}
})();