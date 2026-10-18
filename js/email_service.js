/**
 * ============================================================================
 * FIND MY TUTOR — SISTEMA CENTRALIZZATO DI NOTIFICHE EMAIL GOOGLE
 * Account Ufficiale: staff.findmytutor@istitutoagnelli.it
 * ============================================================================
 * Gestisce l'invio automatico di email formattate HTML per:
 * - Nuove prenotazioni lezioni (singole e di gruppo)
 * - Modifiche lezioni (da studente, tutor o admin)
 * - Cancellazioni lezioni (da studente, tutor o admin) con motivazione
 * - Prenotazione / assegnazione / rimozione aule (notifica a tutor, studenti e staff)
 * - Candidature "Diventa Tutor" e aggiornamenti disponibilità/materie del tutor
 * - Approvazione / rifiuto candidature da parte dell'Admin
 * - Cambi ruolo, modifiche profilo, sospensioni/ban e revoche da parte dell'Admin
 * - Riconoscimento ore FSL (ex PCTO) da parte dello Staff
 * - Valutazioni / feedback lezioni
 *
 * Supporta doppio canale di invio automatico:
 * 1) Funzione Google Apps Script Web App collegata a staff.findmytutor@istitutoagnelli.it
 * 2) Backend Flask (/api/fmt/send_email) con Google SMTP / Apps Script
 */
(function () {
    'use strict';

    const STAFF_EMAIL = 'staff.findmytutor@istitutoagnelli.it';
    const SENDER_NAME = 'FindMyTutor • Istituto Edoardo Agnelli';
    const NATIVE_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyte02Tuoxl4HNvwSXLn90INJ9JF567UJBjyNdCiUOKVxlGq_kEseOotS99I52utTCLMQ/exec';
    const STORAGE_KEY_SCRIPT_URL = 'fmt_google_script_url';
    const STORAGE_KEY_EMAIL_ENABLED = 'fmt_email_notifications_enabled';
    const STORAGE_KEY_CC_STAFF = 'fmt_email_cc_staff';

    // Persistenza nativa permanente dell'URL Google Apps Script
    try {
        if (!localStorage.getItem(STORAGE_KEY_SCRIPT_URL)) {
            localStorage.setItem(STORAGE_KEY_SCRIPT_URL, NATIVE_GOOGLE_SCRIPT_URL);
        }
    } catch (e) {}

    // Cache in-memory per evitare query duplicate a Supabase per gli indirizzi email
    const emailCacheByUserId = new Map();
    const emailCacheByTutorId = new Map();
    const emailCacheByName = new Map();

    let remoteConfigLoaded = false;
    let cachedGoogleScriptUrl = localStorage.getItem(STORAGE_KEY_SCRIPT_URL) || NATIVE_GOOGLE_SCRIPT_URL;

    function getApiBase() {
        if (window.FMT_API && window.FMT_API.BASE) return window.FMT_API.BASE;
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1' || window.location.port === '5000') {
            return 'http://' + h + ':5000';
        }
        return '';
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateIt(dateStr) {
        if (!dateStr) return 'Data da definire';
        try {
            const parts = String(dateStr).split('T')[0].split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString('it-IT', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                    });
                }
            }
            return String(dateStr);
        } catch (e) {
            return String(dateStr);
        }
    }

    function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const clean = email.trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
    }

    /**
     * Carica la configurazione email da Supabase (system_settings) e/o dal backend Flask.
     */
    async function loadConfig() {
        if (remoteConfigLoaded) return getConfig();
        remoteConfigLoaded = true;

        // 1. Prova da Supabase system_settings
        try {
            if (window.supabaseClient) {
                const { data } = await window.supabaseClient
                    .from('system_settings')
                    .select('key, value')
                    .in('key', ['google_script_url', 'email_notifications_enabled', 'email_cc_staff']);

                if (Array.isArray(data)) {
                    data.forEach(row => {
                        if (row.key === 'google_script_url' && row.value) {
                            cachedGoogleScriptUrl = String(row.value).trim();
                            localStorage.setItem(STORAGE_KEY_SCRIPT_URL, cachedGoogleScriptUrl);
                        } else if (row.key === 'email_notifications_enabled' && row.value !== undefined) {
                            localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, String(row.value));
                        } else if (row.key === 'email_cc_staff' && row.value !== undefined) {
                            localStorage.setItem(STORAGE_KEY_CC_STAFF, String(row.value));
                        }
                    });
                }
            }
        } catch (e) {
            // system_settings potrebbe non avere quelle righe, ignora silenziosamente
        }

        // 2. Prova dal backend Flask (/api/fmt/email_config)
        try {
            const base = getApiBase();
            const res = await fetch(base + '/api/fmt/email_config', { method: 'GET' });
            if (res.ok) {
                const cfg = await res.json();
                if (cfg && cfg.google_script_url && !cachedGoogleScriptUrl) {
                    cachedGoogleScriptUrl = String(cfg.google_script_url).trim();
                    localStorage.setItem(STORAGE_KEY_SCRIPT_URL, cachedGoogleScriptUrl);
                }
            }
        } catch (e) {
            // Backend non attivo (modalità statica), usa localStorage/Supabase
        }

        return getConfig();
    }

    function getConfig() {
        const storedUrl = localStorage.getItem(STORAGE_KEY_SCRIPT_URL);
        const scriptUrl = cachedGoogleScriptUrl || storedUrl || NATIVE_GOOGLE_SCRIPT_URL;
        const enabledRaw = localStorage.getItem(STORAGE_KEY_EMAIL_ENABLED);
        const ccStaffRaw = localStorage.getItem(STORAGE_KEY_CC_STAFF);
        return {
            staffEmail: STAFF_EMAIL,
            senderName: SENDER_NAME,
            googleScriptUrl: (scriptUrl || NATIVE_GOOGLE_SCRIPT_URL).trim(),
            enabled: enabledRaw === null ? true : enabledRaw !== 'false',
            ccStaff: ccStaffRaw === null ? true : ccStaffRaw !== 'false'
        };
    }

    async function saveConfig(newConfig = {}) {
        if (typeof newConfig.googleScriptUrl === 'string') {
            cachedGoogleScriptUrl = newConfig.googleScriptUrl.trim();
            localStorage.setItem(STORAGE_KEY_SCRIPT_URL, cachedGoogleScriptUrl);
        }
        if (typeof newConfig.enabled === 'boolean') {
            localStorage.setItem(STORAGE_KEY_EMAIL_ENABLED, String(newConfig.enabled));
        }
        if (typeof newConfig.ccStaff === 'boolean') {
            localStorage.setItem(STORAGE_KEY_CC_STAFF, String(newConfig.ccStaff));
        }

        const cfg = getConfig();

        // Salva su Supabase system_settings se disponibile
        try {
            if (window.supabaseClient) {
                await window.supabaseClient.from('system_settings').upsert([
                    { key: 'google_script_url', value: cfg.googleScriptUrl },
                    { key: 'email_notifications_enabled', value: String(cfg.enabled) },
                    { key: 'email_cc_staff', value: String(cfg.ccStaff) }
                ], { onConflict: 'key' });
            }
        } catch (e) {
            console.warn('Salvataggio config email su Supabase non riuscito:', e);
        }

        // Salva anche sul backend Flask se disponibile
        try {
            const base = getApiBase();
            await fetch(base + '/api/fmt/email_config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    google_script_url: cfg.googleScriptUrl,
                    enabled: cfg.enabled,
                    cc_staff: cfg.ccStaff,
                    gmail_app_password: newConfig.gmailAppPassword || undefined
                })
            });
        } catch (e) {
            // Backend non raggiungibile in modalità solo statica
        }

        return cfg;
    }

    /**
     * Risolve l'indirizzo email di un utente a partire da userId, tutorId o nome completo.
     */
    async function resolveEmail({ userId, tutorId, fullName, fallbackEmail } = {}) {
        if (isValidEmail(fallbackEmail)) return fallbackEmail.trim();

        // Controlla se l'utente corrente corrisponde
        try {
            const savedUserRaw = localStorage.getItem('fmt_user');
            if (savedUserRaw) {
                const savedUser = JSON.parse(savedUserRaw);
                if (savedUser && isValidEmail(savedUser.email)) {
                    if ((userId && savedUser.id === userId) ||
                        (fullName && savedUser.full_name && savedUser.full_name.toLowerCase() === String(fullName).toLowerCase())) {
                        return savedUser.email.trim();
                    }
                }
            }
        } catch (e) {}

        if (userId && emailCacheByUserId.has(String(userId))) {
            return emailCacheByUserId.get(String(userId));
        }
        if (tutorId && emailCacheByTutorId.has(String(tutorId))) {
            return emailCacheByTutorId.get(String(tutorId));
        }
        if (fullName && emailCacheByName.has(String(fullName).toLowerCase())) {
            return emailCacheByName.get(String(fullName).toLowerCase());
        }

        if (window.supabaseClient) {
            // 1. Ricerca tramite tutorId -> tutors.user_id -> profiles.email
            if (tutorId && !String(tutorId).startsWith('mcom_')) {
                try {
                    const { data: tutorRow } = await window.supabaseClient
                        .from('tutors')
                        .select('user_id, full_name')
                        .eq('id', tutorId)
                        .maybeSingle();

                    if (tutorRow && tutorRow.user_id) {
                        const { data: prof } = await window.supabaseClient
                            .from('profiles')
                            .select('email, full_name')
                            .eq('id', tutorRow.user_id)
                            .maybeSingle();
                        if (prof && isValidEmail(prof.email)) {
                            const em = prof.email.trim();
                            emailCacheByTutorId.set(String(tutorId), em);
                            emailCacheByUserId.set(String(tutorRow.user_id), em);
                            if (prof.full_name) emailCacheByName.set(prof.full_name.toLowerCase(), em);
                            return em;
                        }
                    }
                } catch (e) {}
            }

            // 2. Ricerca tramite userId -> profiles.email
            if (userId && !String(userId).startsWith('mcom_')) {
                try {
                    const { data: prof } = await window.supabaseClient
                        .from('profiles')
                        .select('email, full_name')
                        .eq('id', userId)
                        .maybeSingle();
                    if (prof && isValidEmail(prof.email)) {
                        const em = prof.email.trim();
                        emailCacheByUserId.set(String(userId), em);
                        if (prof.full_name) emailCacheByName.set(prof.full_name.toLowerCase(), em);
                        return em;
                    }
                } catch (e) {}
            }

            // 3. Ricerca tramite fullName -> profiles.email
            if (fullName) {
                try {
                    const { data: profs } = await window.supabaseClient
                        .from('profiles')
                        .select('email, full_name')
                        .ilike('full_name', String(fullName).trim())
                        .limit(1);
                    if (Array.isArray(profs) && profs[0] && isValidEmail(profs[0].email)) {
                        const em = profs[0].email.trim();
                        emailCacheByName.set(String(fullName).toLowerCase(), em);
                        return em;
                    }
                } catch (e) {}
            }
        }

        return '';
    }

    /**
     * Risolve una lista di nomi (es. partecipanti gruppo) in indirizzi email validi.
     */
    async function resolveGroupEmails(namesArray) {
        if (!Array.isArray(namesArray) || namesArray.length === 0) return [];
        const emails = [];
        for (const name of namesArray) {
            if (!name) continue;
            const em = await resolveEmail({ fullName: String(name).trim() });
            if (isValidEmail(em) && !emails.includes(em)) {
                emails.push(em);
            }
        }
        return emails;
    }

    /**
     * Genera un template HTML professionale con i colori istituzionali Rosso Agnelli.
     */
    function buildBrandedEmailHtml({
        badgeText = 'NOTIFICA FIND MY TUTOR',
        badgeColor = '#D32F2F',
        title = 'Aggiornamento FindMyTutor',
        subtitle = '',
        greeting = 'Ciao,',
        introHtml = '',
        rows = [],
        highlightBox = null,
        ctaText = 'Apri Piattaforma FindMyTutor',
        ctaUrl = ''
    }) {
        const targetUrl = ctaUrl || (window.location ? window.location.origin : 'https://istitutoagnelli.it');

        const rowsHtml = rows
            .filter(r => r && r.label && r.value !== undefined && r.value !== null && String(r.value).trim() !== '')
            .map(r => `
                <tr>
                    <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:600;width:38%;vertical-align:top;">
                        ${escapeHtml(r.label)}
                    </td>
                    <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">
                        ${r.isHtml ? r.value : escapeHtml(r.value)}
                    </td>
                </tr>
            `).join('');

        const highlightHtml = highlightBox && highlightBox.text ? `
            <div style="margin:20px 0;padding:14px 16px;border-radius:10px;background:${highlightBox.bg || '#fef2f2'};border-left:4px solid ${highlightBox.border || badgeColor};color:${highlightBox.color || '#991b1b'};font-size:13.5px;line-height:1.55;">
                ${highlightBox.title ? `<div style="font-weight:700;margin-bottom:4px;">${escapeHtml(highlightBox.title)}</div>` : ''}
                <div>${highlightBox.isHtml ? highlightBox.text : escapeHtml(highlightBox.text)}</div>
            </div>
        ` : '';

        return `
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px rgba(15,23,42,0.05);">
                    <!-- Header Rosso Agnelli -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#D32F2F 0%,#9A0007 100%);padding:26px 28px;color:#ffffff;">
                            <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">
                                ${escapeHtml(badgeText)}
                            </div>
                            <h1 style="margin:0;font-size:21px;font-weight:800;line-height:1.3;color:#ffffff;">
                                ${escapeHtml(title)}
                            </h1>
                            ${subtitle ? `<p style="margin:6px 0 0 0;font-size:13.5px;color:rgba(255,255,255,0.9);">${escapeHtml(subtitle)}</p>` : ''}
                        </td>
                    </tr>

                    <!-- Corpo principale -->
                    <tr>
                        <td style="padding:26px 28px;">
                            <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:#0f172a;">
                                ${escapeHtml(greeting)}
                            </p>
                            <div style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                                ${introHtml}
                            </div>

                            ${rowsHtml ? `
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;margin:16px 0;">
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>
                            ` : ''}

                            ${highlightHtml}

                            <div style="margin-top:24px;text-align:center;">
                                <a href="${escapeHtml(targetUrl)}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#D32F2F;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                                    ${escapeHtml(ctaText)}
                                </a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer Istituzionale -->
                    <tr>
                        <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
                            <div style="font-weight:700;color:#334155;margin-bottom:4px;">
                                FindMyTutor • Istituto Internazionale Edoardo Agnelli
                            </div>
                            <div>
                                Corso Unione Sovietica 312, 10135 Torino • Contatto diretto:
                                <a href="mailto:${STAFF_EMAIL}" style="color:#D32F2F;text-decoration:none;font-weight:600;">${STAFF_EMAIL}</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
    }

    /**
     * Invia un array di messaggi email tramite:
     * 1) Backend Flask (/api/fmt/send_email) che gestisce sia Google Apps Script sia SMTP Gmail
     * 2) Chiamata diretta alla Google Apps Script Web App se configurata nel browser
     */
    async function dispatchMessages(messages, eventType = 'generic') {
        await loadConfig();
        const cfg = getConfig();
        if (!cfg.enabled) {
            return { ok: false, skipped: true, reason: 'Notifiche email disabilitate nelle impostazioni' };
        }

        // Normalizza e deduplica i messaggi validi
        const normalized = [];
        for (const msg of (Array.isArray(messages) ? messages : [messages])) {
            if (!msg) continue;
            const recipients = (Array.isArray(msg.to) ? msg.to : String(msg.to || '').split(','))
                .map(e => String(e).trim())
                .filter(isValidEmail);

            if (recipients.length === 0) continue;

            normalized.push({
                to: [...new Set(recipients)].join(','),
                cc: msg.cc || '',
                bcc: msg.bcc || '',
                subject: msg.subject || 'Notifica FindMyTutor - Istituto Agnelli',
                htmlBody: msg.htmlBody || '',
                textBody: msg.textBody || '',
                replyTo: msg.replyTo || STAFF_EMAIL,
                eventType: eventType
            });
        }

        if (normalized.length === 0) {
            return { ok: false, skipped: true, reason: 'Nessun destinatario valido' };
        }

        let sentViaBackend = false;
        let backendResult = null;

        // 1. Tentativo tramite Backend Python (/api/fmt/send_email)
        try {
            const base = getApiBase();
            const res = await fetch(base + '/api/fmt/send_email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: eventType,
                    google_script_url: cfg.googleScriptUrl || undefined,
                    messages: normalized
                })
            });
            if (res.ok) {
                backendResult = await res.json();
                if (backendResult && backendResult.ok && backendResult.sent_count > 0) {
                    sentViaBackend = true;
                }
            }
        } catch (err) {
            // Backend non raggiungibile: passa al fallback diretto Google Apps Script
        }

        // 2. Se il backend non ha già inviato e abbiamo l'URL Google Apps Script, invia direttamente dal browser
        let sentViaGoogleScript = false;
        if (!sentViaBackend && cfg.googleScriptUrl) {
            try {
                await fetch(cfg.googleScriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        sender: STAFF_EMAIL,
                        eventType: eventType,
                        messages: normalized
                    })
                });
                sentViaGoogleScript = true;
            } catch (err) {
                console.warn('Errore invio diretto Google Apps Script:', err);
            }
        }

        return {
            ok: sentViaBackend || sentViaGoogleScript,
            sentViaBackend,
            sentViaGoogleScript,
            count: normalized.length,
            backendResult
        };
    }

    // =========================================================================
    // 1. NUOVA PRENOTAZIONE LEZIONE (SINGOLA O DI GRUPPO)
    // =========================================================================
    async function notifyLessonBooked(details = {}) {
        const cfg = getConfig();
        const subjectName = details.subject || 'Materia non specificata';
        const dateFormatted = formatDateIt(details.date);
        const timeSlot = details.time || 'Orario da concordare';
        const duration = details.duration ? `${details.duration} min` : '60 min';
        const studentName = details.studentName || 'Studente';
        const studentClass = details.studentClass || '-';
        const tutorName = details.tutorName || 'Tutor';
        const noteText = details.note || 'Nessun argomento specifico indicato';
        const isGroup = Boolean(details.isGroup) || (Array.isArray(details.groupStudents) && details.groupStudents.length > 0);
        const groupList = Array.isArray(details.groupStudents) ? details.groupStudents : [];

        const [studentEmail, tutorEmail, groupEmails] = await Promise.all([
            resolveEmail({ userId: details.studentId, fullName: studentName, fallbackEmail: details.studentEmail }),
            resolveEmail({ tutorId: details.tutorId, userId: details.tutorUserId, fullName: tutorName, fallbackEmail: details.tutorEmail }),
            resolveGroupEmails(groupList)
        ]);

        const commonRows = [
            { label: 'Materia', value: subjectName },
            { label: 'Data Lezione', value: dateFormatted },
            { label: 'Orario', value: `${timeSlot} (${duration})` },
            { label: 'Tutor', value: tutorName },
            { label: 'Studente Richiedente', value: `${studentName} (${studentClass})` },
            { label: 'Modalità', value: isGroup ? `Lezione di Gruppo (${groupList.length + 1} partecipanti)` : 'Lezione Individuale' },
            ...(groupList.length > 0 ? [{ label: 'Compagni di Gruppo', value: groupList.join(', ') }] : []),
            { label: 'Argomento / Note', value: noteText }
        ];

        const messages = [];

        // Email al Tutor
        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Nuova prenotazione di ${subjectName} da ${studentName} (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'NUOVA PRENOTAZIONE RICEVUTA',
                    title: `Nuova richiesta di ripetizione: ${subjectName}`,
                    subtitle: `${dateFormatted} • Ore ${timeSlot}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `Lo studente <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(studentClass)}) ha appena prenotato una lezione di <strong>${escapeHtml(subjectName)}</strong> con te. Ricordati di prenotare l'aula dalla tua Area Tutor se la lezione si svolgerà in presenza.`,
                    rows: commonRows,
                    highlightBox: {
                        title: 'Prossimo passo consigliato',
                        text: 'Accedi alla sezione "Area Tutor / Appuntamenti" per verificare i dettagli e assegnare un\'aula per la lezione.',
                        bg: '#fef2f2',
                        border: '#D32F2F',
                        color: '#991b1b'
                    },
                    ctaText: 'Vai ai tuoi Appuntamenti Tutor'
                })
            });
        }

        // Email allo Studente (+ eventuali partecipanti del gruppo)
        const studentRecipients = [studentEmail, ...groupEmails].filter(isValidEmail);
        if (studentRecipients.length > 0) {
            messages.push({
                to: studentRecipients,
                subject: `[FindMyTutor] Conferma prenotazione di ${subjectName} con ${tutorName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'PRENOTAZIONE CONFERMATA',
                    badgeColor: '#16a34a',
                    title: `Lezione di ${subjectName} prenotata con successo`,
                    subtitle: `${dateFormatted} • Ore ${timeSlot}`,
                    greeting: `Ciao ${studentName},`,
                    introHtml: `La tua prenotazione per la lezione di <strong>${escapeHtml(subjectName)}</strong> con il tutor <strong>${escapeHtml(tutorName)}</strong> è stata registrata. Riceverai un'ulteriore email non appena il tutor assegnerà l'aula o in caso di modifiche.`,
                    rows: commonRows,
                    highlightBox: {
                        title: 'Gestione Prenotazione',
                        text: 'Puoi modificare l\'argomento, l\'orario o disdire la lezione in qualsiasi momento dalla pagina "Prenota Ripetizioni".',
                        bg: '#f0fdf4',
                        border: '#16a34a',
                        color: '#166534'
                    },
                    ctaText: 'Visualizza le tue Prenotazioni'
                })
            });
        }

        // Email di riepilogo allo Staff (staff.findmytutor@istitutoagnelli.it)
        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Nuova prenotazione: ${studentName} → ${tutorName} (${subjectName})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • NUOVA LEZIONE',
                    title: `Nuova Prenotazione: ${subjectName}`,
                    subtitle: `${studentName} (${studentClass}) con ${tutorName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'È stata registrata una nuova prenotazione sulla piattaforma FindMyTutor.',
                    rows: commonRows
                })
            });
        }

        return dispatchMessages(messages, 'lesson_booked');
    }

    // =========================================================================
    // 2. MODIFICA LEZIONE (DA STUDENTE, TUTOR O ADMIN)
    // =========================================================================
    async function notifyLessonUpdated(details = {}) {
        const cfg = getConfig();
        const actorRole = details.actorRole || 'Studente';
        const actorName = details.actorName || details.studentName || 'Utente';
        const subjectName = details.subject || 'Materia';
        const dateFormatted = formatDateIt(details.date);
        const timeSlot = details.time || 'Orario da concordare';
        const duration = details.duration ? `${details.duration} min` : '60 min';
        const studentName = details.studentName || 'Studente';
        const studentClass = details.studentClass || '-';
        const tutorName = details.tutorName || 'Tutor';
        const noteText = details.note || '-';
        const statusText = details.status || 'Confermato';
        const groupList = Array.isArray(details.groupStudents) ? details.groupStudents : [];

        const [studentEmail, tutorEmail, groupEmails] = await Promise.all([
            resolveEmail({ userId: details.studentId, fullName: studentName, fallbackEmail: details.studentEmail }),
            resolveEmail({ tutorId: details.tutorId, userId: details.tutorUserId, fullName: tutorName, fallbackEmail: details.tutorEmail }),
            resolveGroupEmails(groupList)
        ]);

        const changesSummary = [];
        if (details.previousDate && details.previousDate !== details.date) {
            changesSummary.push(`Data: da ${formatDateIt(details.previousDate)} a ${dateFormatted}`);
        }
        if (details.previousTime && details.previousTime !== details.time) {
            changesSummary.push(`Orario: da ${details.previousTime} a ${timeSlot}`);
        }
        if (details.previousDuration && String(details.previousDuration) !== String(details.duration)) {
            changesSummary.push(`Durata: da ${details.previousDuration} min a ${duration}`);
        }
        if (details.previousNote !== undefined && details.previousNote !== details.note) {
            changesSummary.push(`Argomento/Note aggiornati`);
        }

        const rows = [
            { label: 'Modificato da', value: `${actorName} (${actorRole})` },
            { label: 'Materia', value: subjectName },
            { label: 'Nuova Data', value: dateFormatted },
            { label: 'Nuovo Orario', value: `${timeSlot} (${duration})` },
            { label: 'Tutor', value: tutorName },
            { label: 'Studente', value: `${studentName} (${studentClass})` },
            { label: 'Stato Lezione', value: statusText.toUpperCase() },
            ...(groupList.length > 0 ? [{ label: 'Partecipanti Gruppo', value: groupList.join(', ') }] : []),
            { label: 'Argomento / Note', value: noteText }
        ];

        const highlightBox = changesSummary.length > 0 ? {
            title: 'Riepilogo variazioni effettuate',
            text: changesSummary.join(' • '),
            bg: '#fffbeb',
            border: '#f59e0b',
            color: '#92400e'
        } : {
            title: 'Dettagli aggiornati',
            text: 'I dettagli della prenotazione sono stati modificati. Verifica data, orario e argomento nella tua area personale.',
            bg: '#fffbeb',
            border: '#f59e0b',
            color: '#92400e'
        };

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Modifica lezione di ${subjectName} (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'LEZIONE MODIFICATA',
                    badgeColor: '#d97706',
                    title: `Aggiornamento lezione di ${subjectName}`,
                    subtitle: `Modifica effettuata da ${actorName} (${actorRole})`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `La lezione di <strong>${escapeHtml(subjectName)}</strong> con <strong>${escapeHtml(studentName)}</strong> è stata aggiornata. Di seguito trovi i nuovi dettagli in vigore.`,
                    rows,
                    highlightBox,
                    ctaText: 'Verifica in Area Tutor'
                })
            });
        }

        const studentRecipients = [studentEmail, ...groupEmails].filter(isValidEmail);
        if (studentRecipients.length > 0) {
            messages.push({
                to: studentRecipients,
                subject: `[FindMyTutor] Aggiornamento prenotazione di ${subjectName} con ${tutorName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'PRENOTAZIONE AGGIORNATA',
                    badgeColor: '#d97706',
                    title: `Modifica lezione di ${subjectName}`,
                    subtitle: `${dateFormatted} • Ore ${timeSlot}`,
                    greeting: `Ciao ${studentName},`,
                    introHtml: `I dettagli della tua lezione di <strong>${escapeHtml(subjectName)}</strong> con il tutor <strong>${escapeHtml(tutorName)}</strong> sono stati aggiornati da <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}).`,
                    rows,
                    highlightBox,
                    ctaText: 'Controlla le tue Prenotazioni'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Lezione modificata da ${actorRole}: ${studentName} / ${tutorName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • MODIFICA LEZIONE',
                    badgeColor: '#d97706',
                    title: `Lezione Modificata: ${subjectName}`,
                    subtitle: `Azione eseguita da ${actorName} (${actorRole})`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'Una prenotazione esistente è stata modificata sulla piattaforma.',
                    rows,
                    highlightBox
                })
            });
        }

        return dispatchMessages(messages, 'lesson_updated');
    }

    // =========================================================================
    // 3. CANCELLAZIONE / DISDETTA LEZIONE (DA STUDENTE, TUTOR O ADMIN)
    // =========================================================================
    async function notifyLessonCancelled(details = {}) {
        const cfg = getConfig();
        const cancelledByRole = details.cancelledByRole || 'Utente';
        const cancelledByName = details.cancelledByName || 'Utente';
        const reason = details.reason || 'Nessuna motivazione specificata';
        const subjectName = details.subject || 'Materia';
        const dateFormatted = formatDateIt(details.date);
        const timeSlot = details.time || '-';
        const studentName = details.studentName || 'Studente';
        const studentClass = details.studentClass || '-';
        const tutorName = details.tutorName || 'Tutor';
        const groupList = Array.isArray(details.groupStudents) ? details.groupStudents : [];

        const [studentEmail, tutorEmail, groupEmails] = await Promise.all([
            resolveEmail({ userId: details.studentId, fullName: studentName, fallbackEmail: details.studentEmail }),
            resolveEmail({ tutorId: details.tutorId, userId: details.tutorUserId, fullName: tutorName, fallbackEmail: details.tutorEmail }),
            resolveGroupEmails(groupList)
        ]);

        const rows = [
            { label: 'Annullata da', value: `${cancelledByName} (${cancelledByRole})` },
            { label: 'Materia', value: subjectName },
            { label: 'Data Originaria', value: dateFormatted },
            { label: 'Orario', value: timeSlot },
            { label: 'Tutor', value: tutorName },
            { label: 'Studente', value: `${studentName} (${studentClass})` },
            { label: 'Motivazione Disdetta', value: reason }
        ];

        const highlightBox = {
            title: `Motivazione comunicata da ${cancelledByName} (${cancelledByRole})`,
            text: reason,
            bg: '#fef2f2',
            border: '#dc2626',
            color: '#991b1b'
        };

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Lezione ANNULLATA: ${subjectName} con ${studentName} (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'LEZIONE ANNULLATA',
                    badgeColor: '#dc2626',
                    title: `Disdetta lezione di ${subjectName}`,
                    subtitle: `${dateFormatted} • Ore ${timeSlot}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `La lezione di <strong>${escapeHtml(subjectName)}</strong> prevista con <strong>${escapeHtml(studentName)}</strong> è stata annullata da <strong>${escapeHtml(cancelledByName)}</strong> (${escapeHtml(cancelledByRole)}).`,
                    rows,
                    highlightBox,
                    ctaText: 'Apri Area Tutor'
                })
            });
        }

        const studentRecipients = [studentEmail, ...groupEmails].filter(isValidEmail);
        if (studentRecipients.length > 0) {
            messages.push({
                to: studentRecipients,
                subject: `[FindMyTutor] Lezione ANNULLATA: ${subjectName} con ${tutorName} (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'LEZIONE ANNULLATA',
                    badgeColor: '#dc2626',
                    title: `Lezione di ${subjectName} annullata`,
                    subtitle: `${dateFormatted} • Ore ${timeSlot}`,
                    greeting: `Ciao ${studentName},`,
                    introHtml: `La lezione di <strong>${escapeHtml(subjectName)}</strong> con il tutor <strong>${escapeHtml(tutorName)}</strong> è stata annullata da <strong>${escapeHtml(cancelledByName)}</strong> (${escapeHtml(cancelledByRole)}). Puoi prenotare un nuovo appuntamento in qualsiasi momento.`,
                    rows,
                    highlightBox,
                    ctaText: 'Prenota una Nuova Lezione'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Lezione ANNULLATA da ${cancelledByRole}: ${studentName} / ${tutorName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • CANCELLAZIONE',
                    badgeColor: '#dc2626',
                    title: `Lezione Annullata: ${subjectName}`,
                    subtitle: `Disdetta da ${cancelledByName} (${cancelledByRole})`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'Una lezione programmata è stata annullata sulla piattaforma.',
                    rows,
                    highlightBox
                })
            });
        }

        return dispatchMessages(messages, 'lesson_cancelled');
    }

    // =========================================================================
    // 4. PRENOTAZIONE / RIMOZIONE AULA PER LEZIONE
    // =========================================================================
    async function notifyRoomBooked(details = {}) {
        const cfg = getConfig();
        const tutorName = details.tutorName || 'Tutor';
        const roomNumber = details.roomNumber || '-';
        const floor = details.floor || '-';
        const subjectName = details.subject || 'Ripetizione';
        const dateFormatted = formatDateIt(details.date);
        const tutorEmail = await resolveEmail({
            tutorId: details.tutorId,
            userId: details.tutorUserId,
            fullName: tutorName,
            fallbackEmail: details.tutorEmail
        });

        // Cerca anche gli studenti che hanno una lezione confermata con questo tutor nella stessa data
        const studentEmails = [];
        const studentNames = [];
        try {
            if (window.supabaseClient && details.tutorId && details.date) {
                const { data: apps } = await window.supabaseClient
                    .from('appointments')
                    .select('student_id, student_name, group_students, time')
                    .eq('tutor_id', details.tutorId)
                    .eq('date', details.date)
                    .neq('status', 'cancelled');

                if (Array.isArray(apps)) {
                    for (const app of apps) {
                        if (app.student_name) studentNames.push(app.student_name);
                        const em = await resolveEmail({ userId: app.student_id, fullName: app.student_name });
                        if (isValidEmail(em) && !studentEmails.includes(em)) studentEmails.push(em);
                        if (Array.isArray(app.group_students)) {
                            const gEmails = await resolveGroupEmails(app.group_students);
                            gEmails.forEach(ge => {
                                if (!studentEmails.includes(ge)) studentEmails.push(ge);
                            });
                        }
                    }
                }
            }
        } catch (e) {}

        const rows = [
            { label: 'Aula Assegnata', value: `Aula ${roomNumber} (${floor})` },
            { label: 'Data', value: dateFormatted },
            { label: 'Materia', value: subjectName },
            { label: 'Tutor Responsabile', value: tutorName },
            ...(studentNames.length > 0 ? [{ label: 'Studenti Coinvolti', value: [...new Set(studentNames)].join(', ') }] : [])
        ];

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Conferma Aula ${roomNumber} per il ${dateFormatted}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'AULA CONFERMATA',
                    badgeColor: '#16a34a',
                    title: `Aula ${roomNumber} riservata con successo`,
                    subtitle: `${dateFormatted} • Piano: ${floor}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `Hai riservato correttamente l'<strong>Aula ${escapeHtml(roomNumber)}</strong> (${escapeHtml(floor)}) per la lezione di <strong>${escapeHtml(subjectName)}</strong>.`,
                    rows,
                    ctaText: 'Gestisci Aule in Area Tutor'
                })
            });
        }

        if (studentEmails.length > 0) {
            messages.push({
                to: studentEmails,
                subject: `[FindMyTutor] Aula assegnata per la tua lezione con ${tutorName}: Aula ${roomNumber}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'AULA LEZIONE ASSEGNATA',
                    badgeColor: '#2563eb',
                    title: `La tua lezione si terrà in Aula ${roomNumber}`,
                    subtitle: `${dateFormatted} • Piano: ${floor}`,
                    greeting: 'Ciao,',
                    introHtml: `Il tutor <strong>${escapeHtml(tutorName)}</strong> ha prenotato l'<strong>Aula ${escapeHtml(roomNumber)}</strong> (${escapeHtml(floor)}) per la tua ripetizione del <strong>${escapeHtml(dateFormatted)}</strong>.`,
                    rows,
                    ctaText: 'Visualizza Dettagli Lezione'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Aula ${roomNumber} prenotata da ${tutorName} (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • PRENOTAZIONE AULA',
                    title: `Aula ${roomNumber} riservata da ${tutorName}`,
                    subtitle: `${dateFormatted} • ${subjectName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'È stata registrata una nuova prenotazione aula.',
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'room_booked');
    }

    async function notifyRoomCancelled(details = {}) {
        const cfg = getConfig();
        const tutorName = details.tutorName || 'Tutor';
        const roomNumber = details.roomNumber || '-';
        const subjectName = details.subject || 'Ripetizione';
        const dateFormatted = formatDateIt(details.date);
        const actorRole = details.actorRole || 'Tutor';

        const tutorEmail = await resolveEmail({
            tutorId: details.tutorId,
            userId: details.tutorUserId,
            fullName: tutorName,
            fallbackEmail: details.tutorEmail
        });

        const rows = [
            { label: 'Aula Liberata', value: `Aula ${roomNumber}` },
            { label: 'Data', value: dateFormatted },
            { label: 'Materia', value: subjectName },
            { label: 'Tutor', value: tutorName },
            { label: 'Rimossa da', value: actorRole }
        ];

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Prenotazione Aula ${roomNumber} annullata (${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'PRENOTAZIONE AULA RIMOSSA',
                    badgeColor: '#dc2626',
                    title: `Aula ${roomNumber} liberata`,
                    subtitle: `${dateFormatted}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `La prenotazione dell'<strong>Aula ${escapeHtml(roomNumber)}</strong> per il giorno <strong>${escapeHtml(dateFormatted)}</strong> è stata annullata.`,
                    rows,
                    ctaText: 'Apri Area Tutor'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Aula ${roomNumber} liberata (${tutorName} - ${dateFormatted})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • RIMOZIONE AULA',
                    badgeColor: '#dc2626',
                    title: `Prenotazione Aula ${roomNumber} rimossa`,
                    subtitle: `${dateFormatted}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'Una prenotazione aula è stata rimossa dalla piattaforma.',
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'room_cancelled');
    }

    // =========================================================================
    // 5. CANDIDATURA DIVENTA TUTOR & AGGIORNAMENTO PROFILO TUTOR
    // =========================================================================
    async function notifyTutorApplicationSubmitted(details = {}) {
        const applicantName = details.fullName || 'Studente';
        const applicantClass = details.className || '-';
        const subjects = details.subjects || '-';
        const availability = details.availability || '-';
        const description = details.description || '-';

        const applicantEmail = await resolveEmail({
            userId: details.userId,
            fullName: applicantName,
            fallbackEmail: details.email
        });

        const rows = [
            { label: 'Candidato', value: applicantName },
            { label: 'Classe & Indirizzo', value: applicantClass },
            { label: 'Materie Scelte (Retroattive)', value: subjects },
            { label: 'Fasce Orarie Disponibili', value: availability },
            { label: 'Presentazione / Competenze', value: description }
        ];

        const messages = [];

        if (isValidEmail(applicantEmail)) {
            messages.push({
                to: applicantEmail,
                subject: `[FindMyTutor] Candidatura Tutor ricevuta con successo`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'CANDIDATURA INVIATA',
                    badgeColor: '#2563eb',
                    title: 'La tua richiesta per diventare Tutor è in revisione',
                    subtitle: `${applicantName} • Classe ${applicantClass}`,
                    greeting: `Ciao ${applicantName},`,
                    introHtml: 'Abbiamo ricevuto la tua candidatura per entrare nel team Tutor dell\'Istituto Agnelli. Lo Staff esaminerà la tua richiesta e riceverai una mail di conferma non appena il tuo profilo sarà approvato.',
                    rows,
                    ctaText: 'Vai alla tua Dashboard'
                })
            });
        }

        messages.push({
            to: STAFF_EMAIL,
            subject: `[Staff FindMyTutor] Nuova Candidatura Tutor: ${applicantName} (${applicantClass})`,
            htmlBody: buildBrandedEmailHtml({
                badgeText: 'NUOVA CANDIDATURA TUTOR',
                title: `Nuova richiesta Tutor da ${applicantName}`,
                subtitle: `Classe ${applicantClass}`,
                greeting: 'Staff FindMyTutor,',
                introHtml: `Lo studente <strong>${escapeHtml(applicantName)}</strong> ha inviato una candidatura per diventare Tutor. Accedi al Pannello Admin per approvare o rifiutare la richiesta.`,
                rows,
                ctaText: 'Apri Pannello Admin'
            })
        });

        return dispatchMessages(messages, 'tutor_application_submitted');
    }

    async function notifyTutorProfileUpdated(details = {}) {
        const cfg = getConfig();
        const tutorName = details.fullName || 'Tutor';
        const tutorClass = details.className || '-';
        const subjects = details.subjects || '-';
        const availability = details.availability || '-';
        const description = details.description || '-';

        const tutorEmail = await resolveEmail({
            userId: details.userId,
            tutorId: details.tutorId,
            fullName: tutorName,
            fallbackEmail: details.email
        });

        const rows = [
            { label: 'Tutor', value: tutorName },
            { label: 'Classe & Indirizzo', value: tutorClass },
            { label: 'Materie Insegnate', value: subjects },
            { label: 'Fasce Orarie Disponibili', value: availability },
            { label: 'Descrizione / Bio', value: description }
        ];

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Profilo e disponibilità Tutor aggiornati`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'PROFILO TUTOR AGGIORNATO',
                    badgeColor: '#16a34a',
                    title: 'Disponibilità e materie salvate correttamente',
                    subtitle: `${tutorName} • ${tutorClass}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: 'Le modifiche al tuo profilo Tutor (materie insegnate, fasce orarie e presentazione) sono state salvate e sono ora visibili agli studenti in fase di prenotazione.',
                    rows,
                    ctaText: 'Visualizza il tuo Profilo Tutor'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Aggiornamento profilo Tutor: ${tutorName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • PROFILO TUTOR',
                    title: `Profilo Tutor aggiornato: ${tutorName}`,
                    subtitle: `Classe ${tutorClass}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: `Il tutor <strong>${escapeHtml(tutorName)}</strong> ha aggiornato le proprie materie o disponibilità orarie.`,
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'tutor_profile_updated');
    }

    // =========================================================================
    // 6. AZIONI ADMIN & STAFF (APPROVAZIONE TUTOR, RUOLI, BAN, ORE FSL, RATING)
    // =========================================================================
    async function notifyTutorApplicationProcessed(details = {}) {
        const cfg = getConfig();
        const candidateName = details.fullName || 'Studente';
        const status = details.status || 'approved'; // 'approved' | 'rejected'
        const isApproved = status === 'approved';
        const candidateEmail = await resolveEmail({
            userId: details.userId,
            fullName: candidateName,
            fallbackEmail: details.email
        });

        const rows = [
            { label: 'Candidato', value: candidateName },
            { label: 'Esito Valutazione', value: isApproved ? 'APPROVATA - Ruolo Tutor Attivo' : 'NON APPROVATA' },
            ...(details.subjects ? [{ label: 'Materie Abilitate', value: details.subjects }] : []),
            ...(details.availability ? [{ label: 'Disponibilità', value: details.availability }] : [])
        ];

        const messages = [];

        if (isValidEmail(candidateEmail)) {
            messages.push({
                to: candidateEmail,
                subject: isApproved
                    ? `[FindMyTutor] Congratulazioni! La tua candidatura Tutor è stata APPROVATA`
                    : `[FindMyTutor] Aggiornamento sulla tua candidatura Tutor`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: isApproved ? 'CANDIDATURA APPROVATA' : 'ESITO CANDIDATURA',
                    badgeColor: isApproved ? '#16a34a' : '#dc2626',
                    title: isApproved ? 'Benvenuto nel team Tutor di FindMyTutor!' : 'Esito richiesta Diventa Tutor',
                    subtitle: candidateName,
                    greeting: `Ciao ${candidateName},`,
                    introHtml: isApproved
                        ? 'La tua richiesta per diventare Tutor è stata <strong>approvata</strong> dallo Staff! Ora il tuo profilo compare tra i tutor prenotabili dagli studenti e puoi accedere alla sezione "Area Tutor" per gestire lezioni, aule e ore FSL.'
                        : 'La tua richiesta per diventare Tutor è stata esaminata dallo Staff e al momento non è stata approvata. Per maggiori informazioni puoi contattare direttamente lo Staff rispondendo a questa email.',
                    rows,
                    ctaText: isApproved ? 'Accedi alla tua Area Tutor' : 'Vai a FindMyTutor'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Candidatura Tutor ${isApproved ? 'APPROVATA' : 'RIFIUTATA'}: ${candidateName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • ESITO CANDIDATURA',
                    badgeColor: isApproved ? '#16a34a' : '#dc2626',
                    title: `Candidatura ${isApproved ? 'Approvata' : 'Rifiutata'}: ${candidateName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: `La candidatura di <strong>${escapeHtml(candidateName)}</strong> è stata processata dal pannello di amministrazione.`,
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'tutor_application_processed');
    }

    async function notifyUserRoleChanged(details = {}) {
        const cfg = getConfig();
        const userName = details.fullName || 'Utente';
        const newRole = details.newRole || 'student';
        const classInfo = details.className || '-';
        const userEmail = await resolveEmail({
            userId: details.userId,
            fullName: userName,
            fallbackEmail: details.email
        });

        const rows = [
            { label: 'Utente', value: userName },
            { label: 'Nuovo Ruolo', value: String(newRole).toUpperCase() },
            { label: 'Classe / Indirizzo', value: classInfo }
        ];

        const messages = [];

        if (isValidEmail(userEmail)) {
            messages.push({
                to: userEmail,
                subject: `[FindMyTutor] Aggiornamento profilo / ruolo account (${String(newRole).toUpperCase()})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'AGGIORNAMENTO PROFILO',
                    badgeColor: '#2563eb',
                    title: 'Il tuo profilo FindMyTutor è stato aggiornato',
                    greeting: `Ciao ${userName},`,
                    introHtml: `L'amministrazione di FindMyTutor ha aggiornato le impostazioni del tuo profilo utente.`,
                    rows,
                    ctaText: 'Accedi a FindMyTutor'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Aggiornamento Utente: ${userName} (${String(newRole).toUpperCase()})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • UTENTI',
                    title: `Profilo aggiornato: ${userName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'È stato modificato il ruolo o l\'anagrafica di un utente dal Pannello Admin.',
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'user_role_changed');
    }

    async function notifyUserBanStatusChanged(details = {}) {
        const cfg = getConfig();
        const userName = details.fullName || 'Utente';
        const actionType = details.actionType || 'ban'; // 'ban' | 'degrade' | 'revoked'
        const reason = details.reason || 'Provvedimento amministrativo';
        const untilText = details.untilText || '';

        const userEmail = await resolveEmail({
            userId: details.userId,
            fullName: userName,
            fallbackEmail: details.email
        });

        const isRevoked = actionType === 'revoked';
        const rows = [
            { label: 'Utente', value: userName },
            { label: 'Provvedimento', value: isRevoked ? 'RIABILITAZIONE ACCOUNT' : (actionType === 'degrade' ? 'RIMOZIONE RUOLO TUTOR' : 'SOSPENSIONE ACCOUNT') },
            ...(untilText ? [{ label: 'Durata', value: untilText }] : []),
            { label: 'Motivazione / Note', value: reason }
        ];

        const messages = [];

        if (isValidEmail(userEmail)) {
            messages.push({
                to: userEmail,
                subject: isRevoked
                    ? `[FindMyTutor] Il tuo account è stato riabilitato`
                    : `[FindMyTutor] Comunicazione importante sul tuo account`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: isRevoked ? 'ACCOUNT RIABILITATO' : 'AVVISO AMMINISTRATIVO',
                    badgeColor: isRevoked ? '#16a34a' : '#dc2626',
                    title: isRevoked ? 'Il tuo account FindMyTutor è nuovamente attivo' : 'Notifica sullo stato del tuo account',
                    greeting: `Ciao ${userName},`,
                    introHtml: isRevoked
                        ? 'L\'amministrazione ha revocato le limitazioni sul tuo account FindMyTutor. Puoi tornare a utilizzare regolarmente la piattaforma.'
                        : 'Ti informiamo che l\'amministrazione di FindMyTutor ha applicato un provvedimento sul tuo profilo.',
                    rows
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Provvedimento account (${actionType.toUpperCase()}): ${userName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • MODERAZIONE',
                    badgeColor: isRevoked ? '#16a34a' : '#dc2626',
                    title: `Azione Moderazione: ${userName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: 'È stato registrato un aggiornamento sullo stato di moderazione di un utente.',
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'user_ban_status_changed');
    }

    async function notifyFslHoursAcknowledged(details = {}) {
        const cfg = getConfig();
        const tutorName = details.tutorName || 'Tutor';
        const hoursAck = details.hoursAcknowledged || 0;
        const tutorEmail = await resolveEmail({
            tutorId: details.tutorId,
            userId: details.tutorUserId,
            fullName: tutorName,
            fallbackEmail: details.tutorEmail
        });

        const rows = [
            { label: 'Tutor', value: tutorName },
            { label: 'Totale Ore FSL Riconosciute', value: `${hoursAck} ore` },
            { label: 'Data Convalida', value: formatDateIt(new Date().toISOString().split('T')[0]) }
        ];

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Convalidate le tue ore FSL (${hoursAck} ore totali)`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'CONVALIDA ORE FSL',
                    badgeColor: '#16a34a',
                    title: `Le tue ore di tutorato FSL sono state registrate`,
                    subtitle: `Totale convalidato: ${hoursAck} ore`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `La segreteria / Staff docenti ha convalidato le tue ore di sportello didattico su FindMyTutor per il riconoscimento FSL (Formazione Scuola-Lavoro).`,
                    rows,
                    ctaText: 'Controlla il tuo Monte Ore'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Convalida ore FSL per ${tutorName} (${hoursAck}h)`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • CONVALIDA FSL',
                    badgeColor: '#16a34a',
                    title: `Ore FSL Convalidate: ${tutorName}`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: `Sono state convalidate <strong>${escapeHtml(hoursAck)} ore</strong> totali di attività tutor per ${escapeHtml(tutorName)}.`,
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'fsl_hours_acknowledged');
    }

    async function notifyTutorRated(details = {}) {
        const cfg = getConfig();
        const tutorName = details.tutorName || 'Tutor';
        const studentName = details.studentName || 'Studente';
        const subjectName = details.subject || 'Lezione';
        const score = details.score || 5;

        const tutorEmail = await resolveEmail({
            tutorId: details.tutorId,
            fullName: tutorName,
            fallbackEmail: details.tutorEmail
        });

        const stars = '★'.repeat(Math.max(1, Math.min(5, Number(score)))) + '☆'.repeat(Math.max(0, 5 - Number(score)));
        const rows = [
            { label: 'Tutor', value: tutorName },
            { label: 'Materia', value: subjectName },
            { label: 'Valutazione Ricevuta', value: `${stars} (${score}/5)` }
        ];

        const messages = [];

        if (isValidEmail(tutorEmail)) {
            messages.push({
                to: tutorEmail,
                subject: `[FindMyTutor] Hai ricevuto una nuova valutazione (${score}/5 ★) per ${subjectName}`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'NUOVA VALUTAZIONE LEZIONE',
                    badgeColor: '#f59e0b',
                    title: `Nuovo feedback per la tua lezione di ${subjectName}`,
                    greeting: `Ciao ${tutorName},`,
                    introHtml: `Uno studente ha valutato con <strong>${score}/5 stelle</strong> la ripetizione di <strong>${escapeHtml(subjectName)}</strong> svolta con te. Grazie per il tuo contributo alla comunità scolastica!`,
                    rows,
                    ctaText: 'Vai alla tua Dashboard'
                })
            });
        }

        if (cfg.ccStaff) {
            messages.push({
                to: STAFF_EMAIL,
                subject: `[Staff FindMyTutor] Nuova valutazione ${score}/5 per ${tutorName} (${subjectName})`,
                htmlBody: buildBrandedEmailHtml({
                    badgeText: 'REGISTRO STAFF • FEEDBACK',
                    badgeColor: '#f59e0b',
                    title: `Nuova valutazione: ${tutorName} (${score}/5)`,
                    greeting: 'Staff FindMyTutor,',
                    introHtml: `È stata registrata una nuova valutazione da ${escapeHtml(studentName)} per il tutor ${escapeHtml(tutorName)}.`,
                    rows
                })
            });
        }

        return dispatchMessages(messages, 'tutor_rated');
    }

    /**
     * Invia una mail di test per verificare il collegamento con staff.findmytutor@istitutoagnelli.it
     */
    async function sendTestEmail(targetEmail) {
        const recipient = isValidEmail(targetEmail) ? targetEmail.trim() : STAFF_EMAIL;
        const msg = {
            to: recipient,
            subject: `[FindMyTutor] Test Sistema Email Google (${STAFF_EMAIL})`,
            htmlBody: buildBrandedEmailHtml({
                badgeText: 'TEST SISTEMA EMAIL ATTIVO',
                badgeColor: '#16a34a',
                title: 'Collegamento Email Google Funzionante!',
                subtitle: `Mittente collegato: ${STAFF_EMAIL}`,
                greeting: 'Ciao!',
                introHtml: `Questa è un'email di prova inviata dal sistema automatico di notifiche <strong>FindMyTutor</strong> collegato all'account Google <strong>${STAFF_EMAIL}</strong>. Tutte le prenotazioni, modifiche, cancellazioni, assegnazioni aula e candidature tutor invieranno automaticamente notifiche come questa.`,
                rows: [
                    { label: 'Account Google Mittente', value: STAFF_EMAIL },
                    { label: 'Destinatario Test', value: recipient },
                    { label: 'Data e Ora Invio', value: new Date().toLocaleString('it-IT') },
                    { label: 'Eventi Monitorati', value: 'Prenotazioni, Modifiche, Disdette (Tutor/Studente/Admin), Aule, Candidature Tutor, Ore FSL' }
                ],
                ctaText: 'Apri Piattaforma FindMyTutor'
            })
        };

        return dispatchMessages([msg], 'test_email');
    }

    // Inizializza la configurazione in background all'avvio della pagina
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { loadConfig(); });
    } else {
        loadConfig();
    }

    window.FMTEmailService = {
        STAFF_EMAIL,
        NATIVE_GOOGLE_SCRIPT_URL,
        getConfig,
        loadConfig,
        saveConfig,
        resolveEmail,
        buildBrandedEmailHtml,
        dispatchMessages,
        notifyLessonBooked,
        notifyLessonUpdated,
        notifyLessonCancelled,
        notifyRoomBooked,
        notifyRoomCancelled,
        notifyTutorApplicationSubmitted,
        notifyTutorProfileUpdated,
        notifyTutorApplicationProcessed,
        notifyUserRoleChanged,
        notifyUserBanStatusChanged,
        notifyFslHoursAcknowledged,
        notifyTutorRated,
        sendTestEmail
    };
})();
