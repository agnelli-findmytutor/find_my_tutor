// CONFIGURAZIONE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. CHECK SICUREZZA
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = "login.html"; return; }

    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
    
    if (!profile || profile.role !== 'admin') {
        alert("ACCESSO NEGATO: Area riservata agli amministratori.");
        window.location.href = "dashboard.html";
        return;
    }

    // 2. CARICA TUTTO
    loadStats();
    loadTutorRequests(); // Nuova funzione
    loadUsers();
    loadBookings();
});

// --- FUNZIONI CARICAMENTO ---

async function loadStats() {
    // Conta Utenti
    const { count: uCount } = await sb.from('profiles').select('*', { count: 'exact', head: true });
    document.getElementById('countUsers').innerText = uCount || 0;

    // Conta Tutor
    const { count: tCount } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor');
    document.getElementById('countTutors').innerText = tCount || 0;

    // Conta Richieste Pendenti (NUOVO)
    const { count: reqCount } = await sb.from('tutor_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    document.getElementById('countRequests').innerText = reqCount || 0;

    // Conta Lezioni
    const { count: lCount } = await sb.from('appointments').select('*', { count: 'exact', head: true });
    document.getElementById('countLessons').innerText = lCount || 0;
}

// --- NUOVA FUNZIONE: Carica le Candidature ---
async function loadTutorRequests() {
    const tbody = document.querySelector('#requestsTable tbody');
    tbody.innerHTML = '<tr><td colspan="4"><i class="fas fa-spinner fa-spin"></i> Caricamento...</td></tr>';

    // Scarica solo quelle 'pending' (in attesa)
    const { data: requests, error } = await sb
        .from('tutor_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) { tbody.innerHTML = `<tr><td colspan="4">Errore: ${error.message}</td></tr>`; return; }

    tbody.innerHTML = '';
    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">Nessuna nuova candidatura.</td></tr>';
        return;
    }

    requests.forEach(req => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${req.full_name}</strong><br>
                <small>${req.email}</small><br>
                <small><i class="fas fa-phone"></i> ${req.phone}</small>
            </td>
            <td>
                <span class="badge-info">${req.class_info}</span><br>
                <small style="color:#666;">${req.subjects}</small>
            </td>
            <td><small>${req.availability}</small></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-action btn-save" onclick="processRequest(${req.id}, '${req.email}', 'approved')">
                        <i class="fas fa-check"></i> Approva
                    </button>
                    <button class="btn-action btn-delete" onclick="processRequest(${req.id}, '${req.email}', 'rejected')">
                        <i class="fas fa-times"></i> Rifiuta
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- FUNZIONE CHE APPROVA/RIFIUTA ---
window.processRequest = async (reqId, email, action) => {
    let reason = null;

    if (action === 'approved') {
        if (!confirm("Vuoi APPROVARE questo tutor? L'utente diventerà subito 'Tutor'.")) return;
    } else {
        // SE RIFIUTA: Chiedi il motivo
        reason = prompt("Inserisci il motivo del rifiuto (verrà mostrato all'utente):");
        if (reason === null) return; // Se preme Annulla, esci
        if (reason.trim() === "") reason = "Nessun motivo specificato.";
    }

    try {
        // 1. Aggiorna lo stato della richiesta
        const updateData = { status: action };
        if (reason) updateData.rejection_reason = reason; // Salva il motivo solo se c'è

        const { error: reqError } = await sb
            .from('tutor_requests')
            .update(updateData)
            .eq('id', reqId);

        if (reqError) throw reqError;

        // 2. SE APPROVATO -> Aggiorna ruolo
        if (action === 'approved') {
            const { data: profiles } = await sb.from('profiles').select('id').eq('email', email);
            if (profiles && profiles.length > 0) {
                await sb.from('profiles').update({ role: 'tutor' }).eq('id', profiles[0].id);
                alert(`Candidatura approvata! ${email} è ora un Tutor.`);
            } else {
                alert("Approvato, ma l'utente non è ancora registrato.");
            }
        } else {
            alert("Candidatura rifiutata.");
        }

        // 3. Ricarica
        loadStats();
        loadTutorRequests();
        loadUsers();

    } catch (err) {
        alert("Errore: " + err.message);
    }
};

// --- FUNZIONI ESISTENTI (Utenti e Aule) ---

async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    // ... (Il codice precedente di loadUsers rimane uguale) ...
    const { data: users, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Errore</td></tr>`; return; }
    
    tbody.innerHTML = '';
    users.forEach(u => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${u.email}</strong><br><small>${u.full_name || 'Nessun nome'}</small></td>
            <td><span class="badge-role role-${u.role}">${u.role}</span></td>
            <td>
                <select class="role-select" id="role-${u.id}">
                    <option value="studente" ${u.role === 'studente' ? 'selected' : ''}>Studente</option>
                    <option value="tutor" ${u.role === 'tutor' ? 'selected' : ''}>Tutor</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="btn-action btn-save" onclick="updateUserRole('${u.id}')">
                    <i class="fas fa-save"></i> Salva
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadBookings() {
    const tbody = document.querySelector('#bookingsTable tbody');
    // ... (Il codice precedente di loadBookings rimane uguale) ...
    const { data: bookings } = await sb.from('room_bookings').select('*, profiles(email)').order('created_at', { ascending: false });
    tbody.innerHTML = '';
    if(!bookings || bookings.length===0) { tbody.innerHTML = '<tr><td colspan="4">Nessuna.</td></tr>'; return;}
    bookings.forEach(b => {
        const email = b.profiles ? b.profiles.email : 'Sconosciuto';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${b.room_name}</strong></td>
            <td>${b.day_label} <br> ${b.time_slot}</td>
            <td>${email}</td>
            <td><button class="btn-action btn-delete" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash"></i> Cancella</button></td>
        `;
        tbody.appendChild(row);
    });
}

// Azioni Globali
window.updateUserRole = async (userId) => {
    const newRole = document.getElementById(`role-${userId}`).value;
    if(!confirm(`Cambiare ruolo in "${newRole}"?`)) return;
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Errore: " + error.message);
    else { alert("Ruolo aggiornato!"); loadUsers(); }
};

window.deleteBooking = async (bookingId) => {
    if(!confirm("Cancellare prenotazione?")) return;
    const { error } = await sb.from('room_bookings').delete().eq('id', bookingId);
    if (error) alert("Errore"); else { alert("Cancellata."); loadBookings(); }
};