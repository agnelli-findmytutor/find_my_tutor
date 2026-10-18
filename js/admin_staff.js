document.addEventListener('DOMContentLoaded', () => {
    const addStaffForm = document.getElementById('addStaffForm');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('staffUsername').value.trim();
            const password = document.getElementById('staffPassword').value;
            const fullName = document.getElementById('staffFullName').value.trim();
            
            try {
                const baseUrl = (typeof FMT_API !== 'undefined') ? FMT_API.getBaseUrl() : '';
                const res = await fetch(`${baseUrl}/api/fmt/admin/staff`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (typeof FMT_API !== 'undefined' ? FMT_API.getToken() : '')
                    },
                    body: JSON.stringify({ username, password, full_name: fullName })
                }).then(r => r.json());
                
                if (res.success) {
                    alert('Account Staff FSL creato con successo!');
                    addStaffForm.reset();
                    loadStaffAccounts();
                } else {
                    alert(res.message || 'Errore creazione account.');
                }
            } catch(err) {
                alert('Errore di connessione al server.');
            }
        });
        
        async function loadStaffAccounts() {
            const tbody = document.querySelector('#staffTable tbody');
            try {
                const baseUrl = (typeof FMT_API !== 'undefined') ? FMT_API.getBaseUrl() : '';
                const res = await fetch(`${baseUrl}/api/fmt/admin/staff`, {
                    headers: { 'Authorization': 'Bearer ' + (typeof FMT_API !== 'undefined' ? FMT_API.getToken() : '') }
                }).then(r => r.json());
                
                if (res.success && tbody) {
                    tbody.innerHTML = '';
                    if (!res.staff || res.staff.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Nessun account Staff registrato.</td></tr>';
                        return;
                    }
                    res.staff.forEach(s => {
                        tbody.innerHTML += `<tr>
                            <td><strong>${s.full_name || '-'}</strong></td>
                            <td><code>${s.username || '-'}</code></td>
                            <td><span class="badge-role role-staff"><i class="fas fa-check-circle"></i> Attivo</span></td>
                        </tr>`;
                    });
                }
            } catch(err) {
                console.warn('Caricamento staff locale:', err);
            }
        }
        
        // Carica la lista staff all'avvio e al click sul tab
        loadStaffAccounts();
        const staffTabBtn = document.querySelector('[data-target="tab-staff"]');
        if (staffTabBtn) {
            staffTabBtn.addEventListener('click', loadStaffAccounts);
        }
    }
});
