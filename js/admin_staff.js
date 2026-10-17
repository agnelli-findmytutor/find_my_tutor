document.addEventListener('DOMContentLoaded', () => {
    const addStaffForm = document.getElementById('addStaffForm');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('staffUsername').value;
            const password = document.getElementById('staffPassword').value;
            const fullName = document.getElementById('staffFullName').value;
            
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
                    alert('Account staff creato con successo!');
                    addStaffForm.reset();
                    loadStaffAccounts();
                } else {
                    alert(res.message || 'Errore creazione account.');
                }
            } catch(err) {
                alert('Errore di connessione.');
            }
        });
        
        async function loadStaffAccounts() {
            try {
                const baseUrl = (typeof FMT_API !== 'undefined') ? FMT_API.getBaseUrl() : '';
                const res = await fetch(`${baseUrl}/api/fmt/admin/staff`, {
                    headers: { 'Authorization': 'Bearer ' + (typeof FMT_API !== 'undefined' ? FMT_API.getToken() : '') }
                }).then(r => r.json());
                
                const tbody = document.querySelector('#staffTable tbody');
                if (res.success && tbody) {
                    tbody.innerHTML = '';
                    res.staff.forEach(s => {
                        tbody.innerHTML += `<tr>
                            <td><strong>${s.full_name || '-'}</strong></td>
                            <td>${s.username || '-'}</td>
                            <td><span class="role-badge tutor">Attivo</span></td>
                        </tr>`;
                    });
                }
            } catch(err) {
                console.error(err);
            }
        }
        
        // Carica la lista staff se siamo nel tab staff
        const staffTabBtn = document.querySelector('[data-target="tab-staff"]');
        if (staffTabBtn) {
            staffTabBtn.addEventListener('click', loadStaffAccounts);
        }
    }
});
