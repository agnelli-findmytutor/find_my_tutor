/**
 * FindMyTutor - Configurazione Materie per Classe
 * Fonte: Piano di studi Istituto Agnelli (ITT + Liceo)
 * Escluse: Religione, Scienze Motorie
 *
 * Uso: include questo file prima di qualsiasi altra script che usa SubjectsConfig.
 */

const SCHOOL_SUBJECTS = {
    // ── ITT BIENNIO COMUNE ──────────────────────────────────────────────────
    '1ITT': ["Italiano","Storia","Geografia economica","Diritto ed Economia","Inglese",
              "Biologia e scienze della terra","Chimica","Fisica","Matematica",
              "Tecnologie grafiche","Tecnologie informatiche","Scienze e Tecnologie applicate - Robotica"],
    '2ITT': ["Italiano","Storia","Diritto ed Economia","Inglese",
              "Biologia e scienze della terra","Chimica","Fisica","Matematica",
              "Tecnologie grafiche","Scienze e Tecnologie applicate - Robotica"],

    // ── ITT TRIENNIO – ELETTRONICA ───────────────────────────────────────────
    '3ELN': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Tecnologia e progettazione di sistemi elettrici e elettronici",
              "Elettronica ed Elettrotecnica","Sistemi Elettronici","Biomedica"],
    '4ELN': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Tecnologia e progettazione di sistemi elettrici e elettronici",
              "Elettronica ed Elettrotecnica","Sistemi Elettronici","Biomedica"],
    '5ELN': ["Italiano","Storia","Inglese","Matematica",
              "Tecnologia e progettazione di sistemi elettrici e elettronici",
              "Elettronica ed Elettrotecnica","Sistemi Elettronici","Biomedica"],

    // ── ITT TRIENNIO – ENERGIA ───────────────────────────────────────────────
    '3ENE': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica",
              "Impianti, disegno, progettazione","Sistemi e Automazione"],
    '4ENE': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica",
              "Impianti, disegno, progettazione","Sistemi e Automazione"],
    '5ENE': ["Italiano","Storia","Inglese","Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica",
              "Impianti, disegno, progettazione","Sistemi e Automazione"],

    // ── ITT TRIENNIO – MECCANICA ─────────────────────────────────────────────
    '3MEC': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica","Sistemi e Automazione",
              "Disegno, progettazione ed organizzazione industriale"],
    '4MEC': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica","Sistemi e Automazione",
              "Disegno, progettazione ed organizzazione industriale"],
    '5MEC': ["Italiano","Storia","Inglese","Matematica",
              "Meccanica e Macchine","Tecnologia Meccanica","Sistemi e Automazione",
              "Disegno, progettazione ed organizzazione industriale"],

    // ── ITT TRIENNIO – INFORMATICA ───────────────────────────────────────────
    '3INFO': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
               "Sistemi e Reti","Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
               "Informatica","Telecomunicazioni"],
    '4INFO': ["Italiano","Storia","Inglese","Matematica","Complementi di Matematica",
               "Sistemi e Reti","Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
               "Informatica","Telecomunicazioni"],
    '5INFO': ["Italiano","Storia","Inglese","Matematica",
               "Sistemi e Reti","Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
               "Gestione progetto, organizzazione di impresa","Informatica"],

    // ── LICEO – SEZIONE A ────────────────────────────────────────────────────
    '1A': ["Italiano","Latino","Inglese","Storia","Geography","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno e Storia dell'Arte"],
    '2A': ["Italiano","Latino","Inglese","Storia","Geography","Scienze/Chemistry",
           "Matematica","Fisica","Disegno e Storia dell'Arte"],
    '3A': ["Italiano","Latino","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Disegno e Storia dell'Arte"],
    '4A': ["Italiano","Latino","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Disegno e Storia dell'Arte"],
    '5A': ["Italiano","Latino","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Disegno e Storia dell'Arte"],

    // ── LICEO – SEZIONE B ────────────────────────────────────────────────────
    '1B': ["Italiano","Inglese","Storia","Geography","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno"],
    '2B': ["Italiano","Inglese","Storia","Geography","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno"],
    '3B': ["Italiano","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno"],
    '4B': ["Italiano","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno"],
    '5B': ["Italiano","Inglese","Storia","Filosofia","Scienze/Chemistry",
           "Matematica","Fisica","Informatica","Disegno"],

    // ── LICEO – SEZIONE C ────────────────────────────────────────────────────
    '1C': ["Italiano","Inglese","Storia e Geografia","Scienze Naturali",
           "Matematica","Laboratorio Matematico","Fisica","Informatica","Disegno"],
    '2C': ["Italiano","Inglese","Storia e Geografia","Scienze Naturali",
           "Matematica","Laboratorio Matematico","Fisica","Informatica","Disegno"],
    '3C': ["Italiano","Inglese","Storia","Filosofia","Scienze Naturali",
           "Matematica","Laboratorio Matematico","Fisica","Informatica","Disegno"],
    '4C': ["Italiano","Inglese","Storia","Filosofia","Scienze Naturali",
           "Matematica","Laboratorio Matematico","Fisica","Informatica","Disegno"],
    '5C': ["Italiano","Inglese","Storia","Filosofia","Scienze Naturali",
           "Matematica","Laboratorio Matematico","Fisica","Informatica","Disegno"]
};

// ─── Specializzazioni ITT del triennio ──────────────────────────────────────
const ITT_SPECIALIZATIONS = ['ELN', 'ENE', 'MEC', 'INFO'];
const ITT_SUFFIXES = ['ITT', ...ITT_SPECIALIZATIONS];
const LICEO_SECTIONS = ['A', 'B', 'C'];

const SubjectsConfig = {

    /**
     * Parses a class_info string (e.g. "3C", "4INFO", "1ITT") into its components.
     * @param {string} classInfo
     * @returns {{ year: number, section: string, schoolType: string, classKey: string }|null}
     */
    parseClass(classInfo) {
        if (!classInfo || typeof classInfo !== 'string') return null;
        const str = classInfo.trim().toUpperCase();
        const match = str.match(/^(\d+)([A-Z]+)$/);
        if (!match) return null;

        const year = parseInt(match[1], 10);
        const section = match[2];
        if (!year || !section) return null;

        const schoolType = ITT_SUFFIXES.includes(section) ? 'ITT' : 'Liceo';
        const classKey = `${year}${section}`;

        return { year, section, schoolType, classKey };
    },

    /**
     * Returns the list of subjects for a student's exact class.
     * @param {string} classInfo
     * @returns {string[]}
     */
    getSubjectsForClass(classInfo) {
        const parsed = this.parseClass(classInfo);
        if (!parsed) return [];
        return SCHOOL_SUBJECTS[parsed.classKey] || [];
    },

    /**
     * Returns the full list of subjects a tutor is eligible to teach.
     * A tutor can teach any subject from year 1 up to their current year,
     * within their school path and specialization.
     * Special rule: 5th year Liceo tutors can ALSO teach 1st and 2nd year ITT subjects.
     * @param {string} classInfo
     * @returns {string[]}
     */
    getSubjectsForTutor(classInfo) {
        const parsed = this.parseClass(classInfo);
        if (!parsed) return [];

        const { year, section, schoolType } = parsed;
        const subjectSet = new Set();

        if (schoolType === 'ITT') {
            // Always include common ITT years up to min(year, 2)
            const commonYears = Math.min(year, 2);
            for (let y = 1; y <= commonYears; y++) {
                const key = `${y}ITT`;
                (SCHOOL_SUBJECTS[key] || []).forEach(s => subjectSet.add(s));
            }
            // If year >= 3, include specialization years from 3 up to current year
            if (year >= 3 && ITT_SPECIALIZATIONS.includes(section)) {
                for (let y = 3; y <= year; y++) {
                    const key = `${y}${section}`;
                    (SCHOOL_SUBJECTS[key] || []).forEach(s => subjectSet.add(s));
                }
            }
        } else {
            // Liceo: include all years 1 to current year in the same section
            for (let y = 1; y <= year; y++) {
                const key = `${y}${section}`;
                (SCHOOL_SUBJECTS[key] || []).forEach(s => subjectSet.add(s));
            }
            // Special rule: 5th year Liceo can teach 1st and 2nd year ITT
            if (year === 5) {
                ['1ITT', '2ITT'].forEach(key => {
                    (SCHOOL_SUBJECTS[key] || []).forEach(s => subjectSet.add(s));
                });
            }
        }

        return Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'it'));
    },

    /**
     * Returns true if a tutor with tutorClassInfo can tutor a student with
     * studentClassInfo on the given subject.
     * @param {string} tutorClassInfo
     * @param {string} studentClassInfo
     * @param {string} subject
     * @returns {boolean}
     */
    canTutorTeachStudent(tutorClassInfo, studentClassInfo, subject) {
        const tutor = this.parseClass(tutorClassInfo);
        const student = this.parseClass(studentClassInfo);
        if (!tutor || !student) return false;

        const tutorSubjects = this.getSubjectsForTutor(tutorClassInfo);
        const studentSubjects = this.getSubjectsForClass(studentClassInfo);

        if (!tutorSubjects.includes(subject)) return false;
        if (!studentSubjects.includes(subject)) return false;

        // Same school type: always ok
        if (tutor.schoolType === student.schoolType) return true;

        // Cross-school special rule: 5th year Liceo → 1st or 2nd year ITT
        if (tutor.schoolType === 'Liceo' && tutor.year === 5 &&
            student.schoolType === 'ITT' && student.year <= 2) return true;

        return false;
    },

    /**
     * Populates a <select> element with subjects.
     * @param {HTMLSelectElement} selectElement
     * @param {string[]} subjects
     * @param {string} [placeholder]
     */
    populateSelect(selectElement, subjects, placeholder = 'Seleziona materia...') {
        selectElement.innerHTML = '';
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = placeholder;
        ph.disabled = true;
        ph.selected = true;
        selectElement.appendChild(ph);

        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            selectElement.appendChild(opt);
        });
    },

    /**
     * Renders a grid of checkboxes inside containerElement.
     * @param {HTMLElement} containerElement
     * @param {string[]} subjects
     * @param {string[]} [selectedValues]
     */
    renderCheckboxGrid(containerElement, subjects, selectedValues = []) {
        containerElement.innerHTML = '';
        containerElement.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:8px; margin-top:10px;';

        subjects.forEach(s => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; color:#333; padding:4px 2px;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'subject_checkbox';
            cb.value = s;
            cb.style.cursor = 'pointer';
            if (selectedValues.includes(s)) cb.checked = true;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(s));
            containerElement.appendChild(label);
        });
    },

    /**
     * Returns the school type label for display.
     * @param {string} classInfo
     * @returns {string}
     */
    getSchoolTypeLabel(classInfo) {
        const parsed = this.parseClass(classInfo);
        if (!parsed) return '';
        if (parsed.schoolType === 'ITT') {
            if (parsed.section === 'ITT') return 'ITT (Biennio comune)';
            return `ITT – ${parsed.section}`;
        }
        return `Liceo – Sezione ${parsed.section}`;
    }
};
