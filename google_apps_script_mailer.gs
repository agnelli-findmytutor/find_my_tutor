/**
 * ============================================================================
 * FIND MY TUTOR — GOOGLE APPS SCRIPT EMAIL DISPATCHER
 * Account Google collegato: staff.findmytutor@istitutoagnelli.it
 * ============================================================================
 *
 * ISTRUZIONI DI COLLEGAMENTO RAPIDO (2 MINUTI):
 * 1. Accedi a https://script.google.com con l'account:
 *    staff.findmytutor@istitutoagnelli.it
 * 2. Clicca su "Nuovo progetto", incolla tutto questo codice e salva.
 * 3. Clicca in alto a destra su "Esegui il deployment" -> "Nuovo deployment".
 * 4. Seleziona il tipo "Applicazione web" (icona ingranaggio):
 *    - Descrizione: "FindMyTutor Email Dispatcher"
 *    - Esegui come: "Me (staff.findmytutor@istitutoagnelli.it)"
 *    - Chi ha accesso: "Chiunque" (oppure "Chiunque all'interno di Istituto Agnelli" se usato solo da backend)
 * 5. Autorizza i permessi Gmail quando richiesto e copia l'URL dell'Applicazione Web
 *    (es. https://script.google.com/macros/s/AKfycb.../exec).
 * 6. Incolla l'URL nel Pannello Admin di FindMyTutor -> Impostazioni -> Sistema Email Google
 *    (oppure nella variabile GOOGLE_APPS_SCRIPT_URL in app.py / js/email_service.js).
 */

const SENDER_EMAIL = 'staff.findmytutor@istitutoagnelli.it';
const SENDER_NAME = 'FindMyTutor • Istituto Edoardo Agnelli';

/**
 * Gestisce le richieste POST provenienti dal frontend (js/email_service.js)
 * o dal backend Python (app.py).
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    // Supporta sia invio singolo sia invio multiplo (batch di destinatari)
    const messages = Array.isArray(payload.messages) ? payload.messages : [payload];
    const results = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const toRaw = msg.to || msg.recipient || '';
      const toList = Array.isArray(toRaw)
        ? toRaw.filter(Boolean).join(',')
        : String(toRaw).trim();

      if (!toList) {
        results.push({ ok: false, error: 'Destinatario mancante' });
        continue;
      }

      const subject = msg.subject || 'Notifica FindMyTutor - Istituto Agnelli';
      const htmlBody = msg.htmlBody || msg.html || '';
      const plainBody = msg.textBody || msg.text || stripHtml_(htmlBody);
      const replyTo = msg.replyTo || SENDER_EMAIL;
      const cc = msg.cc || '';
      const bcc = msg.bcc || '';

      const mailOptions = {
        name: SENDER_NAME,
        replyTo: replyTo,
        htmlBody: htmlBody || undefined
      };

      if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(',') : String(cc);
      if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(',') : String(bcc);

      GmailApp.sendEmail(toList, subject, plainBody, mailOptions);
      results.push({ ok: true, to: toList, subject: subject });
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        sender: SENDER_EMAIL,
        sentCount: results.filter(function(r) { return r.ok; }).length,
        results: results,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Endpoint GET di verifica stato del servizio.
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'FindMyTutor Google Mailer',
      account: SENDER_EMAIL,
      status: 'active'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Funzione eseguibile manualmente dall'editor di Apps Script per autorizzare
 * i permessi e inviare una mail di prova a staff.findmytutor@istitutoagnelli.it.
 */
function testEmail() {
  GmailApp.sendEmail(
    SENDER_EMAIL,
    '[FindMyTutor] Test collegamento Google Mailer attivo',
    'Il servizio di invio email automatico FindMyTutor è collegato correttamente a ' + SENDER_EMAIL,
    {
      name: SENDER_NAME,
      htmlBody: '<div style="font-family:Inter,Arial,sans-serif;padding:24px;border:1px solid #fecaca;border-radius:12px;">' +
        '<h2 style="color:#D32F2F;margin-top:0;">FindMyTutor • Collegamento Google Mailer Attivo</h2>' +
        '<p>L\'account <strong>' + SENDER_EMAIL + '</strong> è pronto a inviare notifiche automatiche per prenotazioni, modifiche, cancellazioni, aule e candidature tutor.</p>' +
        '</div>'
    }
  );
}

function stripHtml_(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
