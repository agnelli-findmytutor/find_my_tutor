// CONFIGURAZIONE SUPABASE
const SUPABASE_URL = 'https://dyyulhpyfdrjhbuogjjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eXVsaHB5ZmRyamhidW9nampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0ODU2ODAsImV4cCI6MjA4NjA2MTY4MH0.D5XglxgjIfpiPBcRywP12_jsiHF5FDJyiynhCfLy3F8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe || '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

document.addEventListener('DOMContentLoaded', async () => {

    // --- ELEMENTI DOM ---
    const loginWarning = document.getElementById('loginWarning');
    const mainFormContainer = document.getElementById('mainFormContainer');

    const form = document.getElementById('tutorForm');
    const formContent = document.getElementById('formContent');
    const btnSubmitNew = document.getElementById('btnSubmitNew');
    const btnGroupExisting = document.getElementById('btnGroupExisting');

    // Banner Stato
    const statusBanner = document.getElementById('statusBanner');
    const successBanner = document.getElementById('successBanner');
    const rejectedBanner = document.getElementById('rejectedBanner');
    const rejectReasonText = document.getElementById('rejectReasonText');
    const btnTryAgain = document.getElementById('btnTryAgain');

    // Banner Errore Inline Visibile (Mai nascosto)
    const formInlineErrorBanner = document.getElementById('formInlineErrorBanner');
    const formInlineErrorTitle = document.getElementById('formInlineErrorTitle');
    const formInlineErrorMsg = document.getElementById('formInlineErrorMsg');
    const btnCloseInlineError = document.getElementById('btnCloseInlineError');

    // Modale Conferma Pre-Invio
    const confirmSubmitModal = document.getElementById('confirmSubmitModal');
    const confirmModalTitle = document.getElementById('confirmModalTitle');
    const confirmModalSummary = document.getElementById('confirmModalSummary');
    const btnCancelConfirmModal = document.getElementById('btnCancelConfirmModal');
    const btnConfirmFinalSubmit = document.getElementById('btnConfirmFinalSubmit');

    // Modale Feedback (Successo)
    const modal = document.getElementById('feedbackModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const btnModalClose = document.getElementById('btnModalClose');

    // Modale Alert (Errore / Avviso)
    const alertModal = document.getElementById('alertModal');
    const alertModalTitle = document.getElementById('alertModalTitle');
    const alertModalMessage = document.getElementById('alertModalMessage');
    const btnAlertModalClose = document.getElementById('btnAlertModalClose');

    // --- GESTIONE ERRORI VISIBILI E MODALI ---
    function clearFormError() {
        if (formInlineErrorBanner) formInlineErrorBanner.classList.add('hidden');
        document.querySelectorAll('.input-error-highlight').forEach(el => {
            el.classList.remove('input-error-highlight');
        });
    }

    if (btnCloseInlineError) {
        btnCloseInlineError.addEventListener('click', clearFormError);
    }

    function showModal(title, message) {
        clearFormError();
        if (modalTitle) modalTitle.textContent = title || 'Operazione completata';
        if (modalMessage) modalMessage.textContent = message || '';
        if (modal) modal.classList.remove('hidden');
    }

    function showAlert(title, message, targetElement = null) {
        // 1. Mostra sempre il banner di errore inline visibile e scorri ad esso
        if (formInlineErrorBanner) {
            if (formInlineErrorTitle) formInlineErrorTitle.textContent = title || 'Attenzione';
            if (formInlineErrorMsg) formInlineErrorMsg.textContent = message || '';
            formInlineErrorBanner.classList.remove('hidden');
        }

        // 2. Evidenzia il campo o la sezione interessata
        document.querySelectorAll('.input-error-highlight').forEach(el => el.classList.remove('input-error-highlight'));
        if (targetElement) {
            targetElement.classList.add('input-error-highlight');
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (formInlineErrorBanner) {
            formInlineErrorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 3. Mostra anche il modale di avviso in primo piano
        if (alertModalTitle) alertModalTitle.textContent = title || 'Attenzione';
        if (alertModalMessage) alertModalMessage.textContent = message || '';
        if (alertModal) alertModal.classList.remove('hidden');
    }

    if (btnModalClose) {
        btnModalClose.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
            window.location.reload();
        });
    }

    if (btnAlertModalClose) {
        btnAlertModalClose.addEventListener('click', () => {
            if (alertModal) alertModal.classList.add('hidden');
        });
    }

    if (btnCancelConfirmModal) {
        btnCancelConfirmModal.addEventListener('click', () => {
            if (confirmSubmitModal) confirmSubmitModal.classList.add('hidden');
        });
    }

    // --- ELEMENTI DISPONIBILITÀ E COMPETENZE ---
    const btnAddSlot = document.getElementById('btnAddSlot');
    const slotsContainer = document.getElementById('slotsContainer');
    const availHiddenInput = document.getElementById('availability');
    const manualClassSelect = document.getElementById('manualClassSelect');
    const subjectCheckboxesGrid = document.getElementById('subjectCheckboxesGrid');
    const selectedSubjectsCount = document.getElementById('selectedSubjectsCount');
    const autoCompetencyBlock = document.getElementById('autoCompetencyBlock');
    const acbYearsTag = document.getElementById('acbYearsTag');
    const acbSummaryText = document.getElementById('acbSummaryText');
    const slotSnapFeedback = document.getElementById('slotSnapFeedback');
    const tempStartInput = document.getElementById('tempStart');
    const tempEndInput = document.getElementById('tempEnd');
    const tempDaySelect = document.getElementById('tempDay');

    // --- GENERAZIONE AUTOMATICA BLOCCO DI COMPETENZE ---
    function syncSelectedSubjects() {
        const checked = Array.from(document.querySelectorAll('input[name="subject_checkbox"]:checked'))
                             .map(cb => cb.value);
        const currentClass = (manualClassSelect && manualClassSelect.value)
            ? manualClassSelect.value.trim().toUpperCase()
            : (document.getElementById('classInfo')?.value || '').trim().toUpperCase();

        const classInfoHidden = document.getElementById('classInfo');
        if (classInfoHidden && currentClass) classInfoHidden.value = currentClass;

        const subjectsHidden = document.getElementById('subjects');
        if (subjectsHidden) subjectsHidden.value = checked.join(', ');

        if (selectedSubjectsCount) {
            selectedSubjectsCount.textContent = `${checked.length} ${checked.length === 1 ? 'selezionata' : 'selezionate'}`;
        }

        // Aggiorna il Blocco di Competenze Generato in Automatico
        if (autoCompetencyBlock && acbSummaryText) {
            if (currentClass && checked.length > 0 && typeof SubjectsConfig !== 'undefined') {
                const parsed = SubjectsConfig.parseClass(currentClass);
                const yearsCovered = parsed
                    ? Array.from({ length: parsed.year }, (_, i) => `${i + 1}°`).join(', ') + ` anno ${parsed.schoolType}`
                    : currentClass;

                if (acbYearsTag) {
                    acbYearsTag.textContent = parsed && parsed.year > 1
                        ? `Retroattivo: 1°–${parsed.year}° anno ${parsed.schoolType}`
                        : `1° anno ${parsed ? parsed.schoolType : ''}`;
                }

                acbSummaryText.innerHTML = `
                    <div><strong>Classe di riferimento:</strong> ${escapeHtml(currentClass)} (${escapeHtml(SubjectsConfig.getSchoolTypeLabel(currentClass))})</div>
                    <div style="margin-top:4px;"><strong>Materie incluse nel blocco (${checked.length}):</strong> ${checked.map(escapeHtml).join(', ')}</div>
                    <div style="margin-top:4px; color:#047857; font-weight:600;">
                        <i class="fas fa-check-circle"></i> Abilitazione automatica per studenti di <strong>${escapeHtml(yearsCovered)}</strong> nelle materie selezionate.
                    </div>
                `;
                autoCompetencyBlock.classList.remove('hidden');
            } else {
                autoCompetencyBlock.classList.add('hidden');
            }
        }
    }

    if (subjectCheckboxesGrid) {
        subjectCheckboxesGrid.addEventListener('change', (e) => {
            if (e.target && e.target.name === 'subject_checkbox') {
                clearFormError();
                syncSelectedSubjects();
            }
        });
    }

    function renderSubjectListFromClass(classInfo, preSelected = [], lockToStudentClass = false) {
        const container = document.getElementById('subjectCheckboxesGrid');
        const banner = document.getElementById('classDetectedBanner');
        const classLabel = document.getElementById('classDetectedLabel');
        if (!container) return;

        const parsed = (typeof SubjectsConfig !== 'undefined' && classInfo)
            ? SubjectsConfig.parseClass(classInfo)
            : null;

        if (!parsed) {
            if (banner) banner.style.display = 'none';
            container.innerHTML = '<p style="color:#64748b; font-size:0.88rem; grid-column: 1 / -1; text-align:center; padding: 14px;"><i class="fas fa-hand-point-up" style="color:#D32F2F;"></i> Seleziona la tua classe dal menu qui sopra per visualizzare le materie che frequenti o hai frequentato.</p>';
            syncSelectedSubjects();
            return;
        }

        const cleanClass = parsed.classKey;
        const subjects = SubjectsConfig.getSubjectsForTutor(cleanClass);

        if (banner) banner.style.display = 'flex';
        if (classLabel) classLabel.textContent = `${cleanClass} — ${SubjectsConfig.getSchoolTypeLabel(cleanClass)}`;

        if (manualClassSelect) {
            manualClassSelect.value = cleanClass;
            if (lockToStudentClass) {
                // Se la classe proviene dal profilo certificato dello studente, blocca le classi di altri indirizzi/anni futuri
                Array.from(manualClassSelect.options).forEach(opt => {
                    if (!opt.value) return;
                    const optParsed = SubjectsConfig.parseClass(opt.value);
                    if (optParsed && (optParsed.schoolType !== parsed.schoolType || optParsed.year > parsed.year)) {
                        opt.disabled = true;
                    }
                });
            }
        }

        const classInfoHidden = document.getElementById('classInfo');
        if (classInfoHidden) classInfoHidden.value = cleanClass;

        SubjectsConfig.renderCheckboxGrid(container, subjects, preSelected, cleanClass);
        syncSelectedSubjects();
    }

    if (manualClassSelect) {
        manualClassSelect.addEventListener('change', () => {
            clearFormError();
            const currentChecked = Array.from(document.querySelectorAll('input[name="subject_checkbox"]:checked')).map(cb => cb.value);
            renderSubjectListFromClass(manualClassSelect.value, currentChecked, false);
        });
    }

    let existingRequestId = null;
    let pendingSubmitMode = null; // 'new' | 'update'

    // --- 1. CONTROLLO UTENTE LOGGATO (UNIFICATO TRA GOOGLE E MASTERCOM) ---
    let user = null;
    try {
        const { data } = await sb.auth.getUser();
        user = data?.user || null;
    } catch (e) {}

    let fmtUser = (typeof FMT_API !== 'undefined') ? FMT_API.getCurrentUser() : null;

    if (!user && fmtUser) {
        user = {
            id: fmtUser.google_id || fmtUser.id,
            email: fmtUser.google_email || fmtUser.email,
            user_metadata: {
                full_name: fmtUser.full_name,
                avatar_url: fmtUser.avatar_url
            }
        };
    }

    if (!user) {
        if (mainFormContainer) mainFormContainer.classList.add('hidden');
        if (loginWarning) loginWarning.classList.remove('hidden');
        return;
    }

    if (mainFormContainer) mainFormContainer.classList.remove('hidden');
    if (loginWarning) loginWarning.classList.add('hidden');

    // Pre-popola Nome ed Email dall'utente loggato
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    if (fullNameInput && !fullNameInput.value) {
        fullNameInput.value = user.user_metadata?.full_name || fmtUser?.full_name || '';
    }
    if (emailInput && !emailInput.value) {
        emailInput.value = user.email || fmtUser?.google_email || fmtUser?.email || '';
    }

    // Recupera class_info dal profilo (Mastercom o Supabase)
    let userClassInfo = fmtUser ? fmtUser.class_info : null;
    if (!userClassInfo && fmtUser && fmtUser.class_year && fmtUser.school_type) {
        userClassInfo = `${fmtUser.class_year}${fmtUser.school_type === 'Liceo' ? 'A' : (fmtUser.class_year <= 2 ? 'ITT' : 'INFO')}`;
    }
    if (!userClassInfo && user) {
        try {
            const { data: profile } = await sb.from('profiles').select('class_info').eq('id', user.id).maybeSingle();
            if (profile && profile.class_info) userClassInfo = profile.class_info;
        } catch (e) {}
    }

    renderSubjectListFromClass(userClassInfo, [], !!userClassInfo);

    // --- 2. AUTO-SNAPPING FASCE ORARIE E GESTIONE CHIP ---
    const MIN_AFTERNOON_MIN = 14 * 60 + 15; // 14:15 (855 min)
    const MAX_AFTERNOON_MIN = 18 * 60;      // 18:00 (1080 min)
    const VALID_DURATIONS = [60, 90, 120, 150, 180, 210];

    function timeToMinutes(tStr) {
        if (!tStr || !tStr.includes(':')) return null;
        const [h, m] = tStr.trim().split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    function minutesToTime(totalMin) {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    /**
     * Esegue l'auto-snapping di una coppia di orari (start, end) al quarto d'ora più vicino
     * dentro la finestra 14:15 - 18:00 e con durata valida (60, 90, 120, 150, 180 min).
     */
    function snapTimePair(rawStart, rawEnd) {
        let sMin = timeToMinutes(rawStart);
        let eMin = timeToMinutes(rawEnd);

        if (sMin === null) sMin = 14 * 60 + 45; // Default 14:45
        if (eMin === null) eMin = sMin + 90;    // Default +1h 30m

        // Arrotonda al quarto d'ora (15 min) più vicino
        sMin = Math.round(sMin / 15) * 15;
        eMin = Math.round(eMin / 15) * 15;

        // Clampa inizio tra 14:15 e 17:00
        if (sMin < MIN_AFTERNOON_MIN) sMin = MIN_AFTERNOON_MIN;
        if (sMin > MAX_AFTERNOON_MIN - 60) sMin = MAX_AFTERNOON_MIN - 60;

        // Calcola durata e allinea al multiplo di 30 min valido più vicino (min 60 min)
        let rawDiff = eMin - sMin;
        if (rawDiff < 60) rawDiff = 60;

        let bestDur = VALID_DURATIONS.reduce((prev, curr) =>
            Math.abs(curr - rawDiff) < Math.abs(prev - rawDiff) ? curr : prev
        );

        eMin = sMin + bestDur;
        if (eMin > MAX_AFTERNOON_MIN) {
            eMin = MAX_AFTERNOON_MIN;
            // Ricalcola durata valida massima disponibile
            let maxPossible = eMin - sMin;
            const fittingDurations = VALID_DURATIONS.filter(d => d <= maxPossible);
            if (fittingDurations.length > 0) {
                bestDur = fittingDurations[fittingDurations.length - 1];
                eMin = sMin + bestDur;
            } else {
                sMin = MAX_AFTERNOON_MIN - 60;
                eMin = MAX_AFTERNOON_MIN;
            }
        }

        const snappedStart = minutesToTime(sMin);
        const snappedEnd = minutesToTime(eMin);
        const wasSnapped = (snappedStart !== (rawStart || '').trim()) || (snappedEnd !== (rawEnd || '').trim());

        return {
            start: snappedStart,
            end: snappedEnd,
            wasSnapped,
            durationMin: eMin - sMin
        };
    }

    function showSnapFeedback(msg) {
        if (!slotSnapFeedback) return;
        slotSnapFeedback.innerHTML = `<i class="fas fa-magnet"></i> <span>${escapeHtml(msg)}</span>`;
        slotSnapFeedback.classList.remove('hidden');
        clearTimeout(slotSnapFeedback._hideTimer);
        slotSnapFeedback._hideTimer = setTimeout(() => {
            slotSnapFeedback.classList.add('hidden');
        }, 5000);
    }

    // Auto-snap live quando l'utente modifica gli input orari
    function handleTimeInputAutoSnap() {
        if (!tempStartInput || !tempEndInput) return;
        if (!tempStartInput.value || !tempEndInput.value) return;
        const snapped = snapTimePair(tempStartInput.value, tempEndInput.value);
        if (snapped.wasSnapped) {
            tempStartInput.value = snapped.start;
            tempEndInput.value = snapped.end;
            showSnapFeedback(`Orario allineato automaticamente alla fascia valida: ${snapped.start} – ${snapped.end}`);
        }
    }

    if (tempStartInput) tempStartInput.addEventListener('change', handleTimeInputAutoSnap);
    if (tempEndInput) tempEndInput.addEventListener('change', handleTimeInputAutoSnap);

    function createAvailChip(text) {
        if (!text || !slotsContainer) return;
        const cleanText = text.trim().replace(/\s*-\s*/g, '-');
        const existing = Array.from(slotsContainer.querySelectorAll('.avail-chip span')).map(s => s.innerText.trim());
        if (existing.includes(cleanText)) return;

        const chip = document.createElement('div');
        chip.className = 'avail-chip';
        chip.innerHTML = `
            <i class="far fa-calendar-check"></i>
            <span>${escapeHtml(cleanText)}</span>
            <i class="fas fa-times" title="Rimuovi fascia oraria"></i>
        `;

        chip.querySelector('.fa-times').addEventListener('click', () => {
            chip.remove();
            updateAvailString();
        });

        slotsContainer.appendChild(chip);
        updateAvailString();
    }

    function updateAvailString() {
        const chips = document.querySelectorAll('#slotsContainer .avail-chip span');
        const parts = Array.from(chips).map(c => c.innerText.trim());
        if (availHiddenInput) availHiddenInput.value = parts.join(', ');
    }

    function tryAddSlot(day, rawStart, rawEnd, silent = false) {
        const targetDay = day || (tempDaySelect ? tempDaySelect.value : 'Lunedì');
        const snapped = snapTimePair(rawStart, rawEnd);

        if (tempStartInput) tempStartInput.value = snapped.start;
        if (tempEndInput) tempEndInput.value = snapped.end;

        if (snapped.wasSnapped && !silent) {
            showSnapFeedback(`Fascia allineata automaticamente a ${targetDay} ${snapped.start}–${snapped.end}`);
        }

        const slotText = `${targetDay} ${snapped.start}-${snapped.end}`;
        createAvailChip(slotText);
        clearFormError();
        return true;
    }

    if (btnAddSlot) {
        btnAddSlot.addEventListener('click', () => {
            const day = tempDaySelect ? tempDaySelect.value : 'Lunedì';
            const start = tempStartInput ? tempStartInput.value : '14:45';
            const end = tempEndInput ? tempEndInput.value : '16:15';
            tryAddSlot(day, start, end, false);
        });
    }

    // Bottoni preset orari rapidi
    document.querySelectorAll('.slot-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const start = btn.getAttribute('data-start');
            const end = btn.getAttribute('data-end');
            const day = tempDaySelect ? tempDaySelect.value : 'Lunedì';
            if (tempStartInput) tempStartInput.value = start;
            if (tempEndInput) tempEndInput.value = end;
            tryAddSlot(day, start, end, true);
        });
    });

    // --- 3. CONTROLLO RICHIESTE ESISTENTI ---
    try {
        const { data: request } = await sb
            .from('tutor_requests')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (request) {
            existingRequestId = request.id;

            statusBanner.classList.add('hidden');
            successBanner.classList.add('hidden');
            rejectedBanner.classList.add('hidden');

            if (request.status === 'approved') {
                successBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
            } else if (request.status === 'rejected') {
                rejectedBanner.classList.remove('hidden');
                formContent.classList.add('hidden');
                if (rejectReasonText) {
                    rejectReasonText.textContent = request.rejection_reason || "Non specificato.";
                }
            } else if (request.status === 'pending') {
                document.getElementById('fullName').value = request.full_name || '';
                document.getElementById('email').value = request.email || '';
                document.getElementById('phone').value = request.phone || '';

                const classInfoHidden = document.getElementById('classInfo');
                const subjectsHidden = document.getElementById('subjects');
                if (classInfoHidden) classInfoHidden.value = request.class_info || '';
                if (subjectsHidden) subjectsHidden.value = request.subjects || '';
                if (availHiddenInput) availHiddenInput.value = request.availability || '';

                const savedSubjects = request.subjects ? request.subjects.split(',').map(s => s.trim()) : [];
                renderSubjectListFromClass(request.class_info || userClassInfo, savedSubjects, !!userClassInfo);

                if (request.availability && request.availability.trim() !== "") {
                    const savedSlots = request.availability.split(',');
                    slotsContainer.innerHTML = '';
                    savedSlots.forEach(slotText => {
                        createAvailChip(slotText.trim());
                    });
                }

                statusBanner.classList.remove('hidden');
                btnSubmitNew.classList.add('hidden');
                btnGroupExisting.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Errore controllo richieste:", err);
    }

    // --- 4. PREPARAZIONE, VALIDAZIONE VISIBILE E CONFERMA CANDIDATURA ---
    function prepareAndValidateSubmission() {
        clearFormError();

        // 1. Genera/sincronizza in automatico il blocco di competenze
        syncSelectedSubjects();

        // 2. Auto-snapping automatico della fascia oraria se l'utente non ha ancora premuto "+ Aggiungi"
        updateAvailString();
        if (!availHiddenInput.value || availHiddenInput.value.trim() === "") {
            if (tempStartInput && tempEndInput && tempStartInput.value && tempEndInput.value) {
                const day = tempDaySelect ? tempDaySelect.value : 'Lunedì';
                tryAddSlot(day, tempStartInput.value, tempEndInput.value, false);
            }
        }

        // 3. Validazioni con Error Handling sempre visibile
        const fullNameEl = document.getElementById('fullName');
        const emailEl = document.getElementById('email');
        const phoneEl = document.getElementById('phone');

        if (!fullNameEl.value || fullNameEl.value.trim().length < 3) {
            showAlert("Nome Mancante", "Inserisci il tuo Nome e Cognome completo nella Sezione 1.", fullNameEl);
            return null;
        }

        if (!emailEl.value || !emailEl.value.includes('@')) {
            showAlert("E-mail Non Valida", "Inserisci un indirizzo e-mail istituzionale valido nella Sezione 1.", emailEl);
            return null;
        }

        if (!phoneEl.value || phoneEl.value.trim().length < 6) {
            showAlert("Numero di Telefono Mancante", "Inserisci il tuo numero di telefono (WhatsApp) per essere ricontattato.", phoneEl);
            return null;
        }

        const classValue = document.getElementById('classInfo').value;
        if (!classValue || classValue.trim() === "") {
            showAlert(
                "Classe Mancante",
                "Seleziona la tua classe attuale nella Sezione 2 per generare il blocco di competenze.",
                manualClassSelect || document.getElementById('secCompetencies')
            );
            return null;
        }

        const subjectsValue = document.getElementById('subjects').value;
        if (!subjectsValue || subjectsValue.trim() === "") {
            showAlert(
                "Nessuna Materia Selezionata",
                "Tocca almeno una materia tra quelle che frequenti o hai frequentato nella Sezione 2.",
                subjectCheckboxesGrid || document.getElementById('secCompetencies')
            );
            return null;
        }

        const availValue = document.getElementById('availability').value;
        if (!availValue || availValue.trim() === "") {
            showAlert(
                "Disponibilità Oraria Mancante",
                "Imposta almeno una fascia oraria pomeridiana nella Sezione 3.",
                document.getElementById('secAvailability')
            );
            return null;
        }

        return getFormData();
    }

    function openConfirmationModal(formData, mode) {
        pendingSubmitMode = mode;
        const parsed = (typeof SubjectsConfig !== 'undefined') ? SubjectsConfig.parseClass(formData.class_info) : null;
        const schoolLabel = (typeof SubjectsConfig !== 'undefined')
            ? SubjectsConfig.getSchoolTypeLabel(formData.class_info)
            : formData.class_info;
        const retroText = parsed && parsed.year > 1
            ? `Abilitazione retroattiva automatica per <strong>1°–${parsed.year}° anno ${escapeHtml(parsed.schoolType)}</strong>`
            : `Abilitazione per <strong>1° anno ${parsed ? escapeHtml(parsed.schoolType) : ''}</strong>`;

        if (confirmModalTitle) {
            confirmModalTitle.textContent = mode === 'update'
                ? 'Conferma Aggiornamento Candidatura'
                : 'Conferma Invio Candidatura';
        }

        if (confirmModalSummary) {
            confirmModalSummary.innerHTML = `
                <div class="cs-row">
                    <span class="cs-label"><i class="far fa-id-card"></i> Candidato &amp; Contatti</span>
                    <div class="cs-val">${escapeHtml(formData.full_name)} &bull; ${escapeHtml(formData.email)}<br><small style="color:#64748b;">Tel: ${escapeHtml(formData.phone)}</small></div>
                </div>
                <div class="cs-row">
                    <span class="cs-label"><i class="fas fa-graduation-cap"></i> Classe &amp; Blocco Competenze</span>
                    <div class="cs-val">
                        <strong>${escapeHtml(formData.class_info)}</strong> (${escapeHtml(schoolLabel)})<br>
                        <span style="color:#047857; font-size:0.8rem;"><i class="fas fa-layer-group"></i> ${retroText}</span>
                    </div>
                </div>
                <div class="cs-row">
                    <span class="cs-label"><i class="fas fa-book-open"></i> Materie Selezionate</span>
                    <div class="cs-val">${escapeHtml(formData.subjects)}</div>
                </div>
                <div class="cs-row">
                    <span class="cs-label"><i class="far fa-clock"></i> Disponibilità Settimanale (Allineata)</span>
                    <div class="cs-val">${escapeHtml(formData.availability)}</div>
                </div>
            `;
        }

        if (confirmSubmitModal) {
            confirmSubmitModal.classList.remove('hidden');
        }
    }

    async function executeConfirmedSubmission() {
        const formData = getFormData();
        if (confirmSubmitModal) confirmSubmitModal.classList.add('hidden');

        if (pendingSubmitMode === 'update' && existingRequestId) {
            setLoading(btnUpdate, true, 'Salvataggio...');
            try {
                const { error } = await sb.from('tutor_requests').update(formData).eq('id', existingRequestId);
                if (error) throw error;

                // Se l'utente è già un tutor attivo, sincronizza anche la tabella profiles
                try {
                    const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
                    if (prof && (prof.role === 'tutor' || prof.role === 'admin')) {
                        await sb.from('profiles').update({
                            class_info: formData.class_info,
                            subjects: formData.subjects,
                            availability: formData.availability
                        }).eq('id', user.id);
                    }
                } catch (syncErr) {}

                if (window.FMTEmailService) {
                    window.FMTEmailService.notifyTutorProfileUpdated({
                        userId: user.id,
                        fullName: formData.full_name,
                        email: formData.email,
                        className: formData.class_info,
                        subjects: formData.subjects,
                        availability: formData.availability,
                        description: `Tel: ${formData.phone}`
                    }).catch(console.warn);
                }

                showModal(
                    "Informazioni Aggiornate! ✅",
                    `Le tue materie (${formData.subjects}) e le fasce orarie (${formData.availability}) sono state aggiornate e notificate via email.`
                );
            } catch (err) {
                showAlert("Errore di Aggiornamento", "Si è verificato un problema durante il salvataggio: " + err.message);
            } finally {
                setLoading(btnUpdate, false, '<i class="fas fa-sync-alt"></i> Aggiorna Informazioni');
            }
            return;
        }

        // Invio Nuova Candidatura
        setLoading(btnSubmitNew, true, 'Invio in corso...');
        formData.user_id = user.id;
        formData.status = 'pending';

        try {
            const { data: inserted, error } = await sb.from('tutor_requests').insert([formData]).select().maybeSingle();
            if (error) throw error;

            if (inserted && inserted.id) {
                existingRequestId = inserted.id;
            }

            if (window.FMTEmailService) {
                window.FMTEmailService.notifyTutorApplicationSubmitted({
                    userId: user.id,
                    fullName: formData.full_name,
                    email: formData.email,
                    className: formData.class_info,
                    subjects: formData.subjects,
                    availability: formData.availability,
                    description: `Tel/WhatsApp: ${formData.phone}`
                }).catch(console.warn);
            }

            // Aggiorna subito anche lo stato visivo della pagina (Conferma su pagina + Modale)
            if (statusBanner) statusBanner.classList.remove('hidden');
            if (btnSubmitNew) btnSubmitNew.classList.add('hidden');
            if (btnGroupExisting) btnGroupExisting.classList.remove('hidden');

            showModal(
                "Candidatura Confermata e Inviata! 🎉",
                `Grazie ${formData.full_name}! La tua richiesta per la classe ${formData.class_info} (${formData.subjects}) è stata registrata correttamente e notificata a staff.findmytutor@istitutoagnelli.it.`
            );
        } catch (err) {
            showAlert("Errore di Invio", "Non è stato possibile inviare la candidatura: " + err.message);
            setLoading(btnSubmitNew, false, '<span>Verifica e Invia Candidatura</span> <i class="fas fa-paper-plane"></i>');
        }
    }

    if (btnConfirmFinalSubmit) {
        btnConfirmFinalSubmit.addEventListener('click', executeConfirmedSubmission);
    }

    // --- 5. LISTENER SUBMIT E UPDATE ---
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (existingRequestId) return;
            const validatedData = prepareAndValidateSubmission();
            if (!validatedData) return;
            openConfirmationModal(validatedData, 'new');
        });
    }

    const btnUpdate = document.getElementById('btnUpdate');
    if (btnUpdate) {
        btnUpdate.addEventListener('click', async () => {
            if (!existingRequestId) return;
            const validatedData = prepareAndValidateSubmission();
            if (!validatedData) return;
            openConfirmationModal(validatedData, 'update');
        });
    }

    // --- 6. RITIRA / RIPROVA ---
    const btnWithdraw = document.getElementById('btnWithdraw');
    if (btnWithdraw) {
        btnWithdraw.addEventListener('click', async () => {
            if (!existingRequestId || !confirm("Sei sicuro di voler ritirare la tua candidatura?")) return;
            setLoading(btnWithdraw, true, '...');
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                showModal("Candidatura Ritirata", "La tua richiesta è stata cancellata correttamente.");
            } catch (err) {
                showAlert("Errore", "Impossibile ritirare la candidatura: " + err.message);
                setLoading(btnWithdraw, false, '<i class="fas fa-trash-alt"></i> Ritira Candidatura');
            }
        });
    }

    if (btnTryAgain) {
        btnTryAgain.addEventListener('click', async () => {
            if (!existingRequestId) return;
            btnTryAgain.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparazione...';
            btnTryAgain.disabled = true;
            try {
                const { error } = await sb.from('tutor_requests').delete().eq('id', existingRequestId);
                if (error) throw error;
                window.location.reload();
            } catch (err) {
                showAlert("Errore", "Si è verificato un problema: " + err.message);
                btnTryAgain.innerHTML = '<i class="fas fa-redo"></i> Compila Nuova Candidatura';
                btnTryAgain.disabled = false;
            }
        });
    }

    function getFormData() {
        syncSelectedSubjects();
        updateAvailString();
        return {
            full_name: (document.getElementById('fullName').value || user.user_metadata?.full_name || '').trim(),
            email: (document.getElementById('email').value || user.email || '').trim(),
            phone: (document.getElementById('phone').value || '').trim(),
            class_info: (document.getElementById('classInfo').value || '').trim(),
            subjects: (document.getElementById('subjects').value || '').trim(),
            availability: (document.getElementById('availability').value || '').trim()
        };
    }

    function setLoading(btn, isLoading, text) {
        if (!btn) return;
        if (isLoading) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
            btn.disabled = true;
            btn.style.opacity = "0.75";
        } else {
            btn.innerHTML = text;
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    }
});
