/**
 * FindMyTutor - API Client & Mastercom Integration Layer
 */
const FMT_API = {
    getBaseUrl: function() {
        // Se la pagina è servita direttamente dal server Flask (porta 5000)
        if (window.location.port === "5000") {
            return "";
        }
        // Se aperta da Live Server o altro, mantieni lo stesso hostname (localhost o 127.0.0.1)
        const host = (window.location.hostname && window.location.hostname !== "") 
            ? window.location.hostname 
            : "127.0.0.1";
        return `http://${host}:5000`;
    },

    getToken: function() {
        const token = localStorage.getItem('fmt_token');
        if (token) return token;
        // Fallback su cookie
        const match = document.cookie.match(/(?:^|;\s*)fmt_token=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    },

    getAuthHeaders: function(customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    getMe: async function() {
        const token = this.getToken();
        if (!token) return null;
        const url = `${this.getBaseUrl()}/api/fmt/me`;
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    console.warn("Sessione FMT non valida o scaduta sul server.");
                    this.clearSession();
                }
                return null;
            }
            const data = await res.json();
            if (data.success && data.user) {
                this.setCurrentUser(data.user, token);
                return data.user;
            }
            return null;
        } catch (e) {
            console.warn("Verifica sessione /api/fmt/me offline:", e);
            return this.getCurrentUser();
        }
    },

    getCurrentUser: function() {
        try {
            const raw = localStorage.getItem('fmt_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    namesOrEmailMatch: function(name1, name2, email2 = "") {
        const normalize = (str) => {
            if (!str) return [];
            return String(str).toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(t => t.length > 1);
        };
        const t1 = normalize(name1);
        const t2 = normalize(name2);
        const set1 = new Set(t1);
        const set2 = new Set(t2);
        const isSubset = (a, b) => [...a].every(x => b.has(x));
        const setsEqual = (a, b) => a.size === b.size && isSubset(a, b);

        if (set1.size > 0 && set2.size > 0) {
            if (setsEqual(set1, set2)) return true;
            if (set1.size >= 2 && isSubset(set1, set2)) return true;
            if (set2.size >= 2 && isSubset(set2, set1)) return true;
        }

        if (email2) {
            const prefix = email2.split('@')[0];
            const te = normalize(prefix);
            const sete = new Set(te);
            if (set1.size > 0 && sete.size > 0) {
                if (setsEqual(set1, sete)) return true;
                if (set1.size >= 2 && isSubset(set1, sete)) return true;
                if (sete.size >= 2 && isSubset(sete, set1)) return true;
            }
        }
        return false;
    },

    syncGoogleAccount: async function(googleData) {
        const url = `${this.getBaseUrl()}/api/fmt/sync_google_account`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(googleData)
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (data.success && data.user) {
                this.setCurrentUser(data.user, data.token);
                return data.user;
            }
            return null;
        } catch (e) {
            console.warn("syncGoogleAccount non riuscito (backend offline?):", e);
            return null;
        }
    },

    setCurrentUser: function(user, token) {
        if (!user) return;
        localStorage.setItem('fmt_user', JSON.stringify(user));
        localStorage.setItem('fmt_role', user.role || 'studente');
        localStorage.setItem('fmt_avatar', user.avatar_url || 'https://via.placeholder.com/150');
        localStorage.setItem('fmt_auth_provider', user.auth_provider || 'mastercom');
        if (user.google_id) {
            localStorage.setItem('fmt_google_id', user.google_id);
        }
        if (user.google_email) {
            localStorage.setItem('fmt_google_email', user.google_email);
        }
        if (user.materie) {
            localStorage.setItem('fmt_materie', JSON.stringify(user.materie));
        }
        if (user.orario) {
            localStorage.setItem('fmt_orario', JSON.stringify(user.orario));
        }
        if (token) {
            localStorage.setItem('fmt_token', token);
            document.cookie = `fmt_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
        }
    },

    clearSession: function() {
        localStorage.removeItem('fmt_user');
        localStorage.removeItem('fmt_role');
        localStorage.removeItem('fmt_avatar');
        localStorage.removeItem('fmt_auth_provider');
        localStorage.removeItem('fmt_google_id');
        localStorage.removeItem('fmt_google_email');
        localStorage.removeItem('fmt_materie');
        localStorage.removeItem('fmt_orario');
        localStorage.removeItem('fmt_token');
        document.cookie = "fmt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    },

    loginMastercom: async function(username, password) {
        const url = `${this.getBaseUrl()}/api/mastercom/login`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
        } catch (netErr) {
            console.error("Errore di rete su fetch:", netErr);
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}). Avvia il backend Python con 'python app.py' per consentire l'accesso con Mastercom.`);
        }

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error(`Risposta non valida dal server (HTTP ${res.status}).`);
        }

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Login fallito. Verifica le credenziali Mastercom.');
        }

        this.setCurrentUser(data.user, data.token);
        return data;
    },

    logout: async function() {
        try {
            await fetch(`${this.getBaseUrl()}/api/fmt/logout`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
        } catch (e) {
            console.warn("Logout request non riuscita:", e);
        }
        this.clearSession();
    },

    syncProfile: async function(username, password) {
        const url = `${this.getBaseUrl()}/api/fmt/sync`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
        } catch (netErr) {
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}). Assicurati che app.py sia avviato.`);
        }

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error(`Risposta non valida dal server (HTTP ${res.status}).`);
        }

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Errore durante la sincronizzazione.');
        }
        this.setCurrentUser(data.user);
        return data;
    },

    getTutors: async function() {
        const url = `${this.getBaseUrl()}/api/fmt/tutors`;
        try {
            const res = await fetch(url, {
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Impossibile caricare i tutor.');
            const data = await res.json();
            return data.tutors || [];
        } catch (err) {
            console.warn("FMT_API.getTutors fallback error:", err);
            return [];
        }
    },

    getAppointments: async function(userId, tutorId, date) {
        let url = `${this.getBaseUrl()}/api/fmt/appointments?`;
        const params = [];
        if (userId) params.push(`user_id=${encodeURIComponent(userId)}`);
        if (tutorId) params.push(`tutor_id=${encodeURIComponent(tutorId)}`);
        if (date) params.push(`date=${encodeURIComponent(date)}`);
        url += params.join('&');

        try {
            const res = await fetch(url, {
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Impossibile caricare le prenotazioni.');
            const data = await res.json();
            return data.appointments || [];
        } catch (err) {
            console.warn("FMT_API.getAppointments error:", err);
            return [];
        }
    },

    createAppointment: async function(bookingData) {
        const url = `${this.getBaseUrl()}/api/fmt/appointments`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(bookingData)
            });
        } catch (netErr) {
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}).`);
        }
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Errore durante la prenotazione.');
        }
        return data.appointment;
    },

    updateAppointment: async function(appId, updateData) {
        const url = `${this.getBaseUrl()}/api/fmt/appointments/${encodeURIComponent(appId)}`;
        let res;
        try {
            res = await fetch(url, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
        } catch (netErr) {
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}).`);
        }
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Errore aggiornamento lezione.');
        }
        return data;
    },

    cancelAppointment: async function(appId, reason) {
        const url = `${this.getBaseUrl()}/api/fmt/appointments/${encodeURIComponent(appId)}`;
        let res;
        try {
            res = await fetch(url, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ reason })
            });
        } catch (netErr) {
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}).`);
        }
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Errore cancellazione lezione.');
        }
        return data;
    },

    rateTutor: async function(tutorId, appointmentId, rating) {
        const url = `${this.getBaseUrl()}/api/fmt/ratings`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ tutor_id: tutorId, appointment_id: appointmentId, rating })
            });
        } catch (netErr) {
            throw new Error(`Impossibile connettersi al server (${this.getBaseUrl()}).`);
        }
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Errore salvataggio voto.');
        }
        return data;
    }
};

window.FMT_API = FMT_API;
