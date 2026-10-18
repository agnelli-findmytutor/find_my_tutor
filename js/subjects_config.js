/**
 * FindMyTutor - Configurazione Completa Materie per Classe e Indirizzo
 * Fonte: Piano di studi Istituto Internazionale Edoardo Agnelli (ITT + Liceo Scientifico)
 * Escluse: Religione, Scienze Motorie
 *
 * Regole chiave:
 * 1. Tutte le materie in comune tra ITT e Liceo sono separate esplicitamente con suffisso (ITT) / (Liceo).
 * 2. Uno studente può prenotarsi e dare ripetizioni SOLO di materie che frequenta o che ha frequentato
 *    nel proprio indirizzo di studi (dal 1° anno fino al proprio anno attuale).
 * 3. Le materie scelte da un tutor sono retroattive: es. Matematica (ITT) al 4° anno abilita
 *    automaticamente ad insegnare Matematica (ITT) per 1°, 2°, 3° e 4° anno.
 */

const SCHOOL_SUBJECTS = {
    // ── ITT BIENNIO COMUNE ──────────────────────────────────────────────────
    '1ITT': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Fisica (ITT)",
        "Chimica (ITT)",
        "Biologia e Scienze della Terra (ITT)",
        "Geografia economica",
        "Diritto ed Economia",
        "Disegno e Tecnologie Grafiche (ITT)",
        "Tecnologie informatiche",
        "Scienze e Tecnologie applicate - Robotica"
    ],
    '2ITT': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Fisica (ITT)",
        "Chimica (ITT)",
        "Biologia e Scienze della Terra (ITT)",
        "Diritto ed Economia",
        "Disegno e Tecnologie Grafiche (ITT)",
        "Scienze e Tecnologie applicate - Robotica"
    ],

    // ── ITT TRIENNIO – ELETTRONICA ED ELETTROTECNICA (ELN) ──────────────────
    '3ELN': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Tecnologia e progettazione di sistemi elettrici e elettronici",
        "Elettronica ed Elettrotecnica",
        "Sistemi Automatici ed Elettronici",
        "Biomedica"
    ],
    '4ELN': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Tecnologia e progettazione di sistemi elettrici e elettronici",
        "Elettronica ed Elettrotecnica",
        "Sistemi Automatici ed Elettronici",
        "Biomedica"
    ],
    '5ELN': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Tecnologia e progettazione di sistemi elettrici e elettronici",
        "Elettronica ed Elettrotecnica",
        "Sistemi Automatici ed Elettronici",
        "Biomedica"
    ],

    // ── ITT TRIENNIO – ENERGIA (ENE) ────────────────────────────────────────
    '3ENE': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Meccanica, Macchine ed Energia",
        "Tecnologia Meccanica",
        "Impianti Energetici, Disegno e Progettazione",
        "Sistemi e Automazione"
    ],
    '4ENE': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Meccanica, Macchine ed Energia",
        "Tecnologia Meccanica",
        "Impianti Energetici, Disegno e Progettazione",
        "Sistemi e Automazione"
    ],
    '5ENE': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Meccanica, Macchine ed Energia",
        "Tecnologia Meccanica",
        "Impianti Energetici, Disegno e Progettazione",
        "Sistemi e Automazione"
    ],

    // ── ITT TRIENNIO – MECCANICA E MECCATRONICA (MEC) ───────────────────────
    '3MEC': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Meccanica e Macchine",
        "Tecnologia Meccanica",
        "Sistemi e Automazione",
        "Disegno, progettazione ed organizzazione industriale"
    ],
    '4MEC': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Meccanica e Macchine",
        "Tecnologia Meccanica",
        "Sistemi e Automazione",
        "Disegno, progettazione ed organizzazione industriale"
    ],
    '5MEC': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Meccanica e Macchine",
        "Tecnologia Meccanica",
        "Sistemi e Automazione",
        "Disegno, progettazione ed organizzazione industriale"
    ],

    // ── ITT TRIENNIO – INFORMATICA E TELECOMUNICAZIONI (INFO) ───────────────
    '3INFO': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Informatica (ITT)",
        "Sistemi e Reti",
        "Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
        "Telecomunicazioni"
    ],
    '4INFO': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Complementi di Matematica",
        "Informatica (ITT)",
        "Sistemi e Reti",
        "Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
        "Telecomunicazioni"
    ],
    '5INFO': [
        "Italiano (ITT)",
        "Storia (ITT)",
        "Inglese (ITT)",
        "Matematica (ITT)",
        "Informatica (ITT)",
        "Sistemi e Reti",
        "Tecnologie e progettazione di sistemi informatici e telecomunicazioni",
        "Gestione progetto, organizzazione di impresa"
    ],

    // ── LICEO SCIENTIFICO – SEZIONE A ───────────────────────────────────────
    '1A': [
        "Italiano (Liceo)",
        "Latino",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Geography",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '2A': [
        "Italiano (Liceo)",
        "Latino",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Geography",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '3A': [
        "Italiano (Liceo)",
        "Latino",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '4A': [
        "Italiano (Liceo)",
        "Latino",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '5A': [
        "Italiano (Liceo)",
        "Latino",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],

    // ── LICEO SCIENTIFICO – SEZIONE B (SCIENZE APPLICATE) ───────────────────
    '1B': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Geography",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '2B': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Geography",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '3B': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '4B': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '5B': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Fisica (Liceo)",
        "Scienze e Chimica (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],

    // ── LICEO SCIENTIFICO – SEZIONE C ───────────────────────────────────────
    '1C': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia e Geografia",
        "Matematica (Liceo)",
        "Laboratorio Matematico",
        "Fisica (Liceo)",
        "Scienze Naturali (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '2C': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia e Geografia",
        "Matematica (Liceo)",
        "Laboratorio Matematico",
        "Fisica (Liceo)",
        "Scienze Naturali (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '3C': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Laboratorio Matematico",
        "Fisica (Liceo)",
        "Scienze Naturali (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '4C': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Laboratorio Matematico",
        "Fisica (Liceo)",
        "Scienze Naturali (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ],
    '5C': [
        "Italiano (Liceo)",
        "Inglese (Liceo)",
        "Storia (Liceo)",
        "Filosofia",
        "Matematica (Liceo)",
        "Laboratorio Matematico",
        "Fisica (Liceo)",
        "Scienze Naturali (Liceo)",
        "Informatica (Liceo)",
        "Disegno e Storia dell'Arte (Liceo)"
    ]
};

// ─── Specializzazioni ITT del triennio ──────────────────────────────────────
const ITT_SPECIALIZATIONS = ['ELN', 'ENE', 'MEC', 'INFO'];
const ITT_SUFFIXES = ['ITT', ...ITT_SPECIALIZATIONS];
const LICEO_SECTIONS = ['A', 'B', 'C'];

// Mappa di normalizzazione per materie legacy o provenienti dal Registro Mastercom
const LEGACY_SUBJECT_ALIASES = {
    'italiano': { ITT: 'Italiano (ITT)', Liceo: 'Italiano (Liceo)' },
    'storia': { ITT: 'Storia (ITT)', Liceo: 'Storia (Liceo)' },
    'inglese': { ITT: 'Inglese (ITT)', Liceo: 'Inglese (Liceo)' },
    'matematica': { ITT: 'Matematica (ITT)', Liceo: 'Matematica (Liceo)' },
    'fisica': { ITT: 'Fisica (ITT)', Liceo: 'Fisica (Liceo)' },
    'informatica': { ITT: 'Informatica (ITT)', Liceo: 'Informatica (Liceo)' },
    'chimica': { ITT: 'Chimica (ITT)', Liceo: 'Scienze e Chimica (Liceo)' },
    'biologia e scienze della terra': { ITT: 'Biologia e Scienze della Terra (ITT)', Liceo: 'Scienze Naturali (Liceo)' },
    'scienze/chemistry': { ITT: 'Chimica (ITT)', Liceo: 'Scienze e Chimica (Liceo)' },
    'scienze e chimica': { ITT: 'Chimica (ITT)', Liceo: 'Scienze e Chimica (Liceo)' },
    'scienze naturali': { ITT: 'Biologia e Scienze della Terra (ITT)', Liceo: 'Scienze Naturali (Liceo)' },
    'tecnologie grafiche': { ITT: 'Disegno e Tecnologie Grafiche (ITT)', Liceo: "Disegno e Storia dell'Arte (Liceo)" },
    'disegno e tecnologie grafiche': { ITT: 'Disegno e Tecnologie Grafiche (ITT)', Liceo: "Disegno e Storia dell'Arte (Liceo)" },
    "disegno e storia dell'arte": { ITT: 'Disegno e Tecnologie Grafiche (ITT)', Liceo: "Disegno e Storia dell'Arte (Liceo)" },
    'disegno': { ITT: 'Disegno e Tecnologie Grafiche (ITT)', Liceo: "Disegno e Storia dell'Arte (Liceo)" },
    'sistemi elettronici': { ITT: 'Sistemi Automatici ed Elettronici', Liceo: 'Sistemi Automatici ed Elettronici' },
    'impianti, disegno, progettazione': { ITT: 'Impianti Energetici, Disegno e Progettazione', Liceo: 'Impianti Energetici, Disegno e Progettazione' }
};

const SubjectsConfig = {

    /**
     * Parses a class_info string (e.g. "3C", "4INFO", "1ITT", "4° INFO", "3 ITT", "4 Liceo")
     * into its normalized components.
     * @param {string} classInfo
     * @returns {{ year: number, section: string, schoolType: string, classKey: string, isGeneric?: boolean }|null}
     */
    parseClass(classInfo) {
        if (!classInfo || typeof classInfo !== 'string') return null;
        // Prendi il primo blocco se contiene " | "
        const firstPart = classInfo.split('|')[0].trim().toUpperCase();
        // Rimuovi simboli di grado e spazi multipli
        const cleaned = firstPart.replace(/[°ª]/g, '').replace(/\s+/g, ' ').trim();

        // 1. Formato standard compatto o con spazio: es. "4INFO", "4 INFO", "3A", "2ITT", "3 A LICEO"
        const compact = cleaned.replace(/\s+/g, '');
        const directMatch = compact.match(/^([1-5])(ITT|INFO|ELN|ENE|MEC|[ABC])(?:LICEO|ITT)?$/);
        if (directMatch) {
            const year = parseInt(directMatch[1], 10);
            let section = directMatch[2];
            if (section === 'ITT' && year >= 3) {
                return { year, section: 'ITT', schoolType: 'ITT', classKey: `${year}INFO`, isGeneric: true };
            }
            if (ITT_SPECIALIZATIONS.includes(section) && year <= 2) {
                section = 'ITT';
            }
            const schoolType = ITT_SUFFIXES.includes(section) ? 'ITT' : 'Liceo';
            const classKey = `${year}${section}`;
            return { year, section, schoolType, classKey, isGeneric: false };
        }

        // 2. Formato descrittivo legacy: es. "4 LICEO", "3 ITT", "2 ANNO LICEO"
        const yearMatch = cleaned.match(/([1-5])/);
        if (!yearMatch) return null;
        const year = parseInt(yearMatch[1], 10);

        if (cleaned.includes('LICEO')) {
            const secMatch = cleaned.match(/\b([ABC])\b/);
            const section = secMatch ? secMatch[1] : 'A';
            return { year, section, schoolType: 'Liceo', classKey: `${year}${section}`, isGeneric: !secMatch };
        }
        if (cleaned.includes('INFO')) {
            const sec = year <= 2 ? 'ITT' : 'INFO';
            return { year, section: sec, schoolType: 'ITT', classKey: `${year}${sec}`, isGeneric: false };
        }
        if (cleaned.includes('ELN') || cleaned.includes('ELETTR')) {
            const sec = year <= 2 ? 'ITT' : 'ELN';
            return { year, section: sec, schoolType: 'ITT', classKey: `${year}${sec}`, isGeneric: false };
        }
        if (cleaned.includes('ENE') || cleaned.includes('ENERG')) {
            const sec = year <= 2 ? 'ITT' : 'ENE';
            return { year, section: sec, schoolType: 'ITT', classKey: `${year}${sec}`, isGeneric: false };
        }
        if (cleaned.includes('MEC')) {
            const sec = year <= 2 ? 'ITT' : 'MEC';
            return { year, section: sec, schoolType: 'ITT', classKey: `${year}${sec}`, isGeneric: false };
        }
        if (cleaned.includes('ITT') || cleaned.includes('TECNICO')) {
            const sec = year <= 2 ? 'ITT' : 'ITT';
            return { year, section: sec, schoolType: 'ITT', classKey: year <= 2 ? `${year}ITT` : `${year}INFO`, isGeneric: year >= 3 };
        }

        return null;
    },

    /**
     * Normalizza il nome di una materia (es. da Mastercom o legacy DB) aggiungendo (ITT) o (Liceo)
     * se è una materia comune.
     * @param {string} rawSubject
     * @param {string} [schoolType] - "ITT" o "Liceo"
     * @returns {string}
     */
    normalizeSubjectName(rawSubject, schoolType = null) {
        if (!rawSubject || typeof rawSubject !== 'string') return '';
        const trimmed = rawSubject.trim();
        const low = trimmed.toLowerCase();

        // Se ha già (ITT) o (Liceo), restituiscilo normalizzato
        if (low.endsWith('(itt)') || low.endsWith('(liceo)')) {
            return trimmed;
        }

        if (schoolType && LEGACY_SUBJECT_ALIASES[low] && LEGACY_SUBJECT_ALIASES[low][schoolType]) {
            return LEGACY_SUBJECT_ALIASES[low][schoolType];
        }

        return trimmed;
    },

    /**
     * Rimuove il suffisso (ITT) o (Liceo) per confronti base quando necessario.
     */
    getBaseSubjectName(subject) {
        if (!subject || typeof subject !== 'string') return '';
        return subject.replace(/\s*\((ITT|Liceo)\)\s*$/i, '').trim().toLowerCase();
    },

    /**
     * Confronta due materie tenendo conto della separazione ITT/Liceo e della retrocompatibilità DB.
     */
    subjectsMatch(tutorSubject, targetSubject, schoolTypeContext = null) {
        if (!tutorSubject || !targetSubject) return false;
        const a = tutorSubject.trim();
        const b = targetSubject.trim();
        if (a.toLowerCase() === b.toLowerCase()) return true;

        // Se una materia specifica (ITT) e l'altra specifica (Liceo), NON devono mai coincidere!
        const aIsITT = /\(itt\)$/i.test(a);
        const aIsLiceo = /\(liceo\)$/i.test(a);
        const bIsITT = /\(itt\)$/i.test(b);
        const bIsLiceo = /\(liceo\)$/i.test(b);

        if ((aIsITT && bIsLiceo) || (aIsLiceo && bIsITT)) {
            return false;
        }

        if (schoolTypeContext) {
            const normA = this.normalizeSubjectName(a, schoolTypeContext).toLowerCase();
            const normB = this.normalizeSubjectName(b, schoolTypeContext).toLowerCase();
            if (normA === normB) return true;
        }

        // Se uno dei due è un record legacy senza suffisso (es. "Matematica") e l'altro è "Matematica (ITT)"
        const baseA = this.getBaseSubjectName(a);
        const baseB = this.getBaseSubjectName(b);
        if (baseA === baseB && (!aIsITT && !aIsLiceo || !bIsITT && !bIsLiceo)) {
            return true;
        }

        return false;
    },

    /**
     * Restituisce la lista delle chiavi classe frequentate da uno studente dalla 1ª fino a `maxYear`.
     */
    getClassKeysUpToYear(classInfo, maxYear = null) {
        const parsed = this.parseClass(classInfo);
        if (!parsed) return [];
        const targetYear = maxYear ? Math.min(parsed.year, parseInt(maxYear, 10)) : parsed.year;
        const keys = [];

        if (parsed.schoolType === 'ITT') {
            const commonYears = Math.min(targetYear, 2);
            for (let y = 1; y <= commonYears; y++) {
                keys.push(`${y}ITT`);
            }
            if (targetYear >= 3) {
                if (parsed.isGeneric || parsed.section === 'ITT') {
                    // Se non è specificata la specializzazione triennio, includi tutte le specializzazioni ITT
                    for (let y = 3; y <= targetYear; y++) {
                        ITT_SPECIALIZATIONS.forEach(spec => keys.push(`${y}${spec}`));
                    }
                } else if (ITT_SPECIALIZATIONS.includes(parsed.section)) {
                    for (let y = 3; y <= targetYear; y++) {
                        keys.push(`${y}${parsed.section}`);
                    }
                }
            }
        } else {
            for (let y = 1; y <= targetYear; y++) {
                if (parsed.isGeneric) {
                    LICEO_SECTIONS.forEach(sec => keys.push(`${y}${sec}`));
                } else {
                    keys.push(`${y}${parsed.section}`);
                }
            }
        }
        return keys;
    },

    /**
     * Returns the list of subjects for a student's exact class and year.
     * @param {string} classInfo
     * @returns {string[]}
     */
    getSubjectsForClass(classInfo) {
        const parsed = this.parseClass(classInfo);
        if (!parsed) return [];
        if (parsed.isGeneric) {
            return this.getSubjectsForYearAndSchool(parsed.year, parsed.schoolType);
        }
        return SCHOOL_SUBJECTS[parsed.classKey] || [];
    },

    /**
     * Restituisce tutte le materie previste per un dato anno (1..5) e indirizzo ("ITT" o "Liceo"),
     * oppure solo quelle della specifica classe dello studente se nota.
     */
    getSubjectsForYearAndSchool(year, schoolType, studentClassInfo = null) {
        const yNum = parseInt(year, 10);
        if (!yNum || !schoolType) return [];

        // Se conosciamo la classe specifica dello studente (es. 4INFO), usiamo il suo percorso!
        if (studentClassInfo) {
            const parsedStudent = this.parseClass(studentClassInfo);
            if (parsedStudent && parsedStudent.schoolType === schoolType && !parsedStudent.isGeneric) {
                // Lo studente può prenotare solo materie che frequenta o ha frequentato (yNum <= parsedStudent.year)
                if (yNum > parsedStudent.year) return [];
                if (schoolType === 'ITT') {
                    const key = yNum <= 2 ? `${yNum}ITT` : `${yNum}${parsedStudent.section}`;
                    return (SCHOOL_SUBJECTS[key] || []).slice().sort((a, b) => a.localeCompare(b, 'it'));
                } else {
                    const key = `${yNum}${parsedStudent.section}`;
                    return (SCHOOL_SUBJECTS[key] || []).slice().sort((a, b) => a.localeCompare(b, 'it'));
                }
            }
        }

        const subjectSet = new Set();
        if (schoolType === 'ITT') {
            if (yNum <= 2) {
                (SCHOOL_SUBJECTS[`${yNum}ITT`] || []).forEach(s => subjectSet.add(s));
            } else {
                ITT_SPECIALIZATIONS.forEach(spec => {
                    (SCHOOL_SUBJECTS[`${yNum}${spec}`] || []).forEach(s => subjectSet.add(s));
                });
            }
        } else if (schoolType === 'Liceo') {
            LICEO_SECTIONS.forEach(sec => {
                (SCHOOL_SUBJECTS[`${yNum}${sec}`] || []).forEach(s => subjectSet.add(s));
            });
        }

        return Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'it'));
    },

    /**
     * Restituisce i dettagli di retroattività per ogni materia insegnabile da un tutor della classe `classInfo`.
     * @param {string} classInfo
     * @returns {Map<string, { subject: string, years: number[], minYear: number, maxYear: number, badgeText: string }>}
     */
    getRetroactiveMapForClass(classInfo) {
        const parsed = this.parseClass(classInfo);
        const map = new Map();
        if (!parsed) return map;

        const { year, section, schoolType } = parsed;

        for (let y = 1; y <= year; y++) {
            let keysForYear = [];
            if (schoolType === 'ITT') {
                if (y <= 2) {
                    keysForYear = [`${y}ITT`];
                } else if (ITT_SPECIALIZATIONS.includes(section)) {
                    keysForYear = [`${y}${section}`];
                } else {
                    keysForYear = ITT_SPECIALIZATIONS.map(spec => `${y}${spec}`);
                }
            } else {
                keysForYear = parsed.isGeneric ? LICEO_SECTIONS.map(sec => `${y}${sec}`) : [`${y}${section}`];
            }

            keysForYear.forEach(k => {
                (SCHOOL_SUBJECTS[k] || []).forEach(subj => {
                    if (!map.has(subj)) {
                        map.set(subj, { subject: subj, years: [], minYear: y, maxYear: y, badgeText: '' });
                    }
                    const entry = map.get(subj);
                    if (!entry.years.includes(y)) {
                        entry.years.push(y);
                        entry.minYear = Math.min(entry.minYear, y);
                        entry.maxYear = Math.max(entry.maxYear, y);
                    }
                });
            });
        }

        map.forEach(entry => {
            entry.years.sort((a, b) => a - b);
            if (entry.years.length > 1) {
                entry.badgeText = `Abilita: ${entry.years.map(y => y + '°').join(', ')} anno (Retroattiva)`;
            } else {
                entry.badgeText = `Abilita: ${entry.years[0]}° anno`;
            }
        });

        return map;
    },

    /**
     * Returns the full list of subjects a student/tutor has attended from year 1 up to their current year
     * within their school path and specialization.
     * @param {string} classInfo
     * @returns {string[]}
     */
    getSubjectsForTutor(classInfo) {
        const retroMap = this.getRetroactiveMapForClass(classInfo);
        return Array.from(retroMap.keys()).sort((a, b) => a.localeCompare(b, 'it'));
    },

    /**
     * Alias semantico per le materie che uno studente frequenta o ha frequentato (1°..suo anno).
     */
    getAttendedSubjectsForStudent(classInfo) {
        return this.getSubjectsForTutor(classInfo);
    },

    /**
     * Returns true if a tutor with tutorClassInfo can tutor a student with
     * studentClassInfo (or studentYear + studentSchoolType) on the given subject.
     * Regola retroattiva: un tutor di anno T può insegnare una materia che ha frequentato
     * a qualsiasi studente dello stesso indirizzo di anno S <= T!
     */
    canTutorTeachStudent(tutorClassInfo, studentClassInfo, subject) {
        const tutor = this.parseClass(tutorClassInfo);
        const student = this.parseClass(studentClassInfo);
        if (!tutor || !student) return false;

        // Indirizzi separati ITT vs Liceo
        if (tutor.schoolType !== student.schoolType) return false;

        // Il tutor deve essere di anno >= anno dello studente (retroattività)
        if (tutor.year < student.year) return false;

        const tutorSubjects = this.getSubjectsForTutor(tutorClassInfo);
        const studentSubjects = this.getAttendedSubjectsForStudent(studentClassInfo);

        const tutorHasSubj = tutorSubjects.some(ts => this.subjectsMatch(ts, subject, tutor.schoolType));
        const studentHasSubj = studentSubjects.some(ss => this.subjectsMatch(ss, subject, student.schoolType));

        return tutorHasSubj && studentHasSubj;
    },

    /**
     * Populates a <select> element with subjects.
     * @param {HTMLSelectElement} selectElement
     * @param {string[]} subjects
     * @param {string} [placeholder]
     */
    populateSelect(selectElement, subjects, placeholder = 'Seleziona materia...') {
        if (!selectElement) return;
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
     * Renders a grid of interactive checkbox cards inside containerElement,
     * showing the retroactive year coverage badge on each card.
     * @param {HTMLElement} containerElement
     * @param {string[]} subjects
     * @param {string[]} [selectedValues]
     * @param {string} [classInfo]
     */
    renderCheckboxGrid(containerElement, subjects, selectedValues = [], classInfo = null) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        containerElement.className = 'subjects-interactive-grid';
        containerElement.style.cssText = '';

        const parsed = classInfo ? this.parseClass(classInfo) : null;
        const schoolType = parsed ? parsed.schoolType : null;
        const retroMap = classInfo ? this.getRetroactiveMapForClass(classInfo) : new Map();

        subjects.forEach((s, idx) => {
            const label = document.createElement('label');
            const isChecked = selectedValues.some(sel => this.subjectsMatch(sel, s, schoolType));
            label.className = 'subject-check-card' + (isChecked ? ' is-checked' : '');
            label.style.animationDelay = `${Math.min(idx * 0.02, 0.3)}s`;

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.name = 'subject_checkbox';
            cb.value = s;
            if (isChecked) cb.checked = true;

            cb.addEventListener('change', () => {
                label.classList.toggle('is-checked', cb.checked);
            });

            const checkIcon = document.createElement('span');
            checkIcon.className = 'subj-check-box';
            checkIcon.innerHTML = '<i class="fas fa-check"></i>';

            const textWrap = document.createElement('div');
            textWrap.className = 'subj-check-text-wrap';

            const textSpan = document.createElement('span');
            textSpan.className = 'subj-check-label';
            textSpan.textContent = s;
            textWrap.appendChild(textSpan);

            const retroInfo = retroMap.get(s);
            if (retroInfo && retroInfo.badgeText) {
                const badgeSpan = document.createElement('small');
                badgeSpan.className = 'subj-retro-badge';
                badgeSpan.innerHTML = `<i class="fas fa-layer-group"></i> ${retroInfo.badgeText}`;
                textWrap.appendChild(badgeSpan);
            }

            label.appendChild(cb);
            label.appendChild(checkIcon);
            label.appendChild(textWrap);
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
            if (parsed.section === 'ITT') return `ITT Biennio (${parsed.year}° anno)`;
            return `ITT – ${parsed.section} (${parsed.year}° anno)`;
        }
        return `Liceo Scientifico – Sez. ${parsed.section} (${parsed.year}° anno)`;
    }
};
