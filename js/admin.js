// --- CONFIGURAZIONE ---
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8'; 
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabili Stato
let currentLessons = [];
let allUsers = []; 
let selectedId = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. CHECK SICUREZZA
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
        alert("ACCESSO NEGATO.");
        window.location.href = "dashboard.html";
        return;
    }

    // 2. LOAD DATA
    loadStats();
    loadTutorRequests(); 
    loadRequestsHistory();
    loadUsers();
    loadBookings(); 
    loadAllAppointments(); 
    loadCancelledLessons();

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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${u.email}</strong><br>
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
    if (error) alert("Errore: " + error.message); else { alert("Ruolo aggiornato!"); loadUsers(); }
};

// --- CANDIDATURE ---
async function loadTutorRequests() {
    const tbody = document.querySelector('#requestsTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">...</td></tr>';
    const { data: requests, error } = await sb.from('tutor_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Errore</td></tr>`; return; }
    tbody.innerHTML = '';
    if (!requests || requests.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessuna candidatura.</td></tr>'; return; }
    requests.forEach(req => {
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${req.full_name}</strong><br><small>${req.email}</small></td><td><span class="badge-info">${req.class_info}</span><br><small>${req.subjects}</small></td><td><small>${req.availability}</small></td><td><div style="display:flex; gap:5px;"><button class="btn-action btn-save" onclick="processRequest(${req.id}, '${req.email}', 'approved')"><i class="fas fa-check"></i></button><button class="btn-action btn-delete" onclick="processRequest(${req.id}, '${req.email}', 'rejected')"><i class="fas fa-times"></i></button></div></td>`;
        tbody.appendChild(row);
    });
}
// ... (Il resto delle funzioni di storico, aule e lezioni rimane identico a prima, non serve modificarle) ...
// Per brevità, assicurati che loadRequestsHistory, loadBookings, loadAllAppointments ecc siano presenti.
// Copia le funzioni "mancanti" dal file precedente se necessario, qui sotto ne rimetto le essenziali:

async function loadRequestsHistory() {
    const tbody = document.querySelector('#requestsHistoryTable tbody');
    if(!tbody) return; 
    tbody.innerHTML = '<tr><td colspan="4">...</td></tr>';
    const { data, error } = await sb.from('tutor_requests').select('*').neq('status', 'pending').order('created_at', { ascending: false });
    if (error) return; 
    tbody.innerHTML = '';
    if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nessuno storico.</td></tr>'; return; }
    data.forEach(req => {
        const isApp = req.status === 'approved';
        const badge = isApp ? `<span style="background:#e8f5e9; color:#2e7d32; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">APPROVATA</span>` : `<span style="background:#ffebee; color:#c62828; padding:4px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold;">RIFIUTATA</span>`;
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${req.full_name}</strong><br><small>${req.email}</small></td><td>${badge}</td><td><small>${new Date(req.created_at).toLocaleDateString()}</small></td><td><button class="btn-action btn-delete" onclick="deleteRequest(${req.id})"><i class="fas fa-trash"></i></button></td>`;
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
    const { data: bookings } = await sb.from('room_bookings').select('*, profiles(email)').order('created_at', { ascending: false });
    tbody.innerHTML = '';
    if(!bookings || bookings.length===0) { tbody.innerHTML = '<tr><td colspan="4">Nessuna.</td></tr>'; return;}
    bookings.forEach(b => {
        const email = b.profiles ? b.profiles.email : 'Sconosciuto';
        const row = document.createElement('tr');
        row.innerHTML = `<td><strong>${b.room_name}</strong></td><td>${b.day_label} <br> ${b.time_slot}</td><td>${email}</td><td><button class="btn-action btn-delete" onclick="deleteBooking('${b.id}')">Cancella</button></td>`;
        tbody.appendChild(row);
    });
}

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