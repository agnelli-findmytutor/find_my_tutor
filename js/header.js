document.addEventListener('DOMContentLoaded', async () => {
    
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    // 1. CONTROLLO SESSIONE VELOCE (getSession è più rapido di getUser per la UI)
    const { data: { session } } = await sbClient.auth.getSession();

    if (session) {
        // UTENTE LOGGATO: Mostra menu utente, nascondi Accedi
        if(loginBtn) loginBtn.style.display = 'none';
        if(userMenu) userMenu.style.display = 'flex';
        
        // Opzionale: Mostra nome utente se hai lo span
        // const userNameSpan = document.getElementById('headerUserName');
        // if(userNameSpan) userNameSpan.textContent = session.user.user_metadata.full_name || "Ciao!";

    } else {
        // UTENTE NON LOGGATO: Mostra Accedi, nascondi menu utente
        if(loginBtn) loginBtn.style.display = 'block'; // O 'inline-block' in base al tuo CSS
        if(userMenu) userMenu.style.display = 'none';
    }

    // 2. GESTIONE LOGOUT
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await sbClient.auth.signOut();
            window.location.href = 'index.html'; // Torna alla home
        });
    }
});