from flask import Flask, request, jsonify, render_template, session, make_response, send_from_directory
from MastercomAPI import MastercomAPI
import os
import requests
import time
import json
import re
import random
import string
import sqlite3
import hashlib
import smtplib
import urllib.parse
import subprocess
import tempfile
import shutil
import uuid
import hmac
import base64
from functools import wraps
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date, time as dtime, timedelta

try:
    # pyrefly: ignore [missing-import]
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "chiave_super_segreta_statica_vercel_123")
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=365)
app.config['SESSION_COOKIE_SECURE'] = (os.environ.get("VERCEL") == "1")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Abilita CORS per supportare sia chiamate locali che da altri domini/porte
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        origin = request.headers.get('Origin') or '*'
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-User-Hash'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
        return response

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin') or '*'
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-User-Hash'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

# Versione app: traccia il commit SHA o versione
APP_VERSION = "v1.8.0"

def get_app_build_info():
    commit = os.environ.get("VERCEL_GIT_COMMIT_SHA")
    if commit:
        return {"version": APP_VERSION, "build_id": commit[:7]}
    try:
        commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL).decode("ascii").strip()
        if commit:
            return {"version": APP_VERSION, "build_id": commit}
    except Exception:
        pass
    return {"version": APP_VERSION, "build_id": APP_VERSION}

GLOBAL_CACHE = {}
GLOBAL_API = {}
CACHE_DURATION = int(os.environ.get("CACHE_DURATION", 7200)) # 2 ore (7200 secondi)


# Database temporaneo in RAM per i codici amico
SHARE_DB = {}

# ── Database persistente su SQLite ──
def get_db_path():
    env_path = os.environ.get("SQLITE_DB_PATH")
    if env_path:
        return env_path
    
    local_dir = os.path.dirname(__file__) or "."
    local_path = os.path.join(local_dir, 'leaderboard.db')
    
    # Se l'ambiente è Vercel / serverless oppure la directory dell'applicazione non è scrivibile
    is_serverless = bool(
        os.environ.get("VERCEL") == "1" or
        os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or
        not os.access(local_dir, os.W_OK)
    )
    
    if is_serverless:
        tmp_dir = "/tmp" if os.path.exists("/tmp") and os.path.isdir("/tmp") else tempfile.gettempdir()
        tmp_path = os.path.join(tmp_dir, "leaderboard.db")
        # Se non esiste ancora in /tmp ma esiste nel bundle di distribuzione, copialo per conservare i dati
        if not os.path.exists(tmp_path) and os.path.exists(local_path):
            try:
                shutil.copy2(local_path, tmp_path)
            except Exception:
                pass
        return tmp_path
    
    return local_path

DB_PATH = get_db_path()


def get_db():
    global DB_PATH
    dir_name = os.path.dirname(DB_PATH) or "."
    if not os.access(dir_name, os.W_OK):
        DB_PATH = get_db_path()
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    try:
        with get_db() as conn:
            # Cache persistente dati studente
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_data (
                    user_hash TEXT PRIMARY KEY,
                    data      TEXT NOT NULL,
                    last_sync REAL NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS leaderboard (
                    user_hash    TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    media        REAL NOT NULL,
                    submitted_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            # Preferenze utente (consenso classifica) — salvate lato server
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_prefs (
                    user_hash  TEXT PRIMARY KEY,
                    lb_consent TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            # Conteggio messaggi AI giornalieri per utente
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ai_usage (
                    user_hash  TEXT,
                    usage_date TEXT,
                    count      INTEGER DEFAULT 0,
                    PRIMARY KEY (user_hash, usage_date)
                )
            """)
            # Sottoscrittori notifiche push per polling background
            conn.execute("""
                CREATE TABLE IF NOT EXISTS push_subscribers (
                    user_hash  TEXT PRIMARY KEY,
                    username   TEXT NOT NULL,
                    password   TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            # Preferenze notifiche utente (categoria per categoria)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_notify_prefs (
                    user_hash  TEXT PRIMARY KEY,
                    prefs_json TEXT NOT NULL,
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            # Codici di condivisione e confronto persistenti
            conn.execute("""
                CREATE TABLE IF NOT EXISTS share_codes (
                    code       TEXT PRIMARY KEY,
                    user_hash  TEXT NOT NULL,
                    data_json  TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            # Token privati per feed iCalendar / Google Calendar
            conn.execute("""
                CREATE TABLE IF NOT EXISTS calendar_tokens (
                    user_hash  TEXT PRIMARY KEY,
                    feed_token TEXT UNIQUE NOT NULL,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            # Registro storico notifiche push inviate (deduplicazione assoluta persistente)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sent_notifications (
                    notification_id TEXT PRIMARY KEY,
                    user_hash       TEXT NOT NULL,
                    category        TEXT NOT NULL,
                    item_key        TEXT NOT NULL,
                    title           TEXT,
                    sent_at         TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sent_notif_user ON sent_notifications(user_hash)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sent_notif_item ON sent_notifications(item_key)")

            # --- TABELLE FIND MY TUTOR ---
            conn.execute("""
                CREATE TABLE IF NOT EXISTS fmt_users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    avatar_url TEXT,
                    role TEXT DEFAULT 'studente',
                    school_type TEXT,
                    class_year TEXT,
                    class_info TEXT,
                    materie TEXT,
                    raw_materie TEXT,
                    orario TEXT,
                    last_sync REAL,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS fmt_appointments (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    tutor_id TEXT NOT NULL,
                    student_name TEXT NOT NULL,
                    student_email TEXT,
                    subject TEXT NOT NULL,
                    date TEXT NOT NULL,
                    time_slot TEXT NOT NULL,
                    duration TEXT DEFAULT '60 min',
                    status TEXT DEFAULT 'Confermato',
                    tutor_name_cache TEXT,
                    notes TEXT,
                    room_name TEXT,
                    is_group INTEGER DEFAULT 0,
                    group_members TEXT,
                    cancellation_reason TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS fmt_tutors (
                    id TEXT PRIMARY KEY,
                    full_name TEXT NOT NULL,
                    email TEXT,
                    class_info TEXT,
                    subjects TEXT,
                    availability TEXT,
                    avatar_url TEXT,
                    rating REAL DEFAULT 5.0,
                    rating_count INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS fmt_ratings (
                    id TEXT PRIMARY KEY,
                    tutor_id TEXT NOT NULL,
                    appointment_id TEXT,
                    rating INTEGER NOT NULL,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                )
            """)

            # Migration colonne account unificato (Mastercom + Google)
            for col in ["google_id TEXT", "google_email TEXT", "linked_account_id TEXT"]:
                try:
                    conn.execute(f"ALTER TABLE fmt_users ADD COLUMN {col}")
                except Exception:
                    pass
            for col in ["google_id TEXT"]:
                try:
                    conn.execute(f"ALTER TABLE fmt_appointments ADD COLUMN {col}")
                except Exception:
                    pass
            for col in ["cancellation_notified INTEGER DEFAULT 0"]:
                try:
                    conn.execute(f"ALTER TABLE fmt_appointments ADD COLUMN {col}")
                except Exception:
                    pass
            for col in ["fsl_acknowledged REAL DEFAULT 0"]:
                try:
                    conn.execute(f"ALTER TABLE fmt_tutors ADD COLUMN {col}")
                except Exception:
                    pass

            # Seed default tutors se la tabella e' vuota
            tutor_count = conn.execute("SELECT count(*) FROM fmt_tutors").fetchone()[0]
            if tutor_count == 0:
                default_tutors = [
                    ("tutor_rossi", "Marco Rossi", "marco.rossi@istitutoagnelli.it", "4° ITT Informatica | 5° ITT Informatica", "Informatica, Sistemi e Reti, TPSIT, Telecomunicazioni, Matematica, GPOI", "Lunedì 15:00-17:00, Mercoledì 15:00-17:30", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", 4.9, 14),
                    ("tutor_bianchi", "Sofia Bianchi", "sofia.bianchi@istitutoagnelli.it", "4° Liceo Scientifico | 5° Liceo Scientifico", "Matematica, Fisica, Latino, Italiano, Storia, Inglese", "Martedì 14:45-16:45, Giovedì 15:00-17:00", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150", 5.0, 22),
                    ("tutor_galli", "Alessandro Galli", "alessandro.galli@istitutoagnelli.it", "4° ITT Meccanica | 5° ITT Meccanica", "Meccanica, Disegno, Tecnologie Meccaniche, Matematica, Fisica", "Lunedì 15:00-17:00, Venerdì 15:00-17:00", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", 4.8, 9),
                    ("tutor_ferrari", "Chiara Ferrari", "chiara.ferrari@istitutoagnelli.it", "4° ITT Elettronica | 5° ITT Elettronica", "Elettronica, Elettrotecnica, Sistemi Automatici, Matematica, Telecomunicazioni", "Mercoledì 15:00-17:00, Giovedì 15:00-16:30", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150", 4.9, 18),
                    ("tutor_brambilla", "Matteo Brambilla", "matteo.brambilla@istitutoagnelli.it", "4° Liceo Scientifico | 5° Liceo Scientifico", "Filosofia, Storia, Italiano, Latino, Inglese, Scienze", "Martedì 15:00-17:00, Venerdì 14:45-16:45", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", 4.7, 11),
                    ("tutor_esposito", "Andrea Esposito", "andrea.esposito@istitutoagnelli.it", "5° ITT Informatica", "Informatica, Sistemi e Reti, GPOI, Inglese, Matematica, TPSIT", "Lunedì 15:00-17:00, Giovedì 15:00-17:00", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150", 5.0, 16)
                ]
                for dt in default_tutors:
                    conn.execute("""
                        INSERT INTO fmt_tutors (id, full_name, email, class_info, subjects, availability, avatar_url, rating, rating_count)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, dt)

            conn.commit()
    except Exception as e:
        app.logger.warning(f"Inizializzazione DB protetta: {e}")


init_leaderboard_db = init_db
init_db()


DEFAULT_NOTIFY_PREFS = {
    "all": True,
    "voti": True,
    "compiti": True,
    "argomenti": True,
    "agenda": True,
    "notizie": True,
    "assenze": True,
    "note": True
}

def get_user_notify_prefs(user_hash: str) -> dict:
    if not user_hash:
        return dict(DEFAULT_NOTIFY_PREFS)
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT prefs_json FROM user_notify_prefs WHERE user_hash = ?",
                (user_hash,)
            ).fetchone()
            if row and row["prefs_json"]:
                saved = json.loads(row["prefs_json"])
                res = dict(DEFAULT_NOTIFY_PREFS)
                res.update(saved)
                return res
    except Exception as e:
        app.logger.warning(f"Errore lettura user_notify_prefs per {user_hash}: {e}")
    return dict(DEFAULT_NOTIFY_PREFS)

def save_user_notify_prefs(user_hash: str, prefs: dict) -> bool:
    if not user_hash or not isinstance(prefs, dict):
        return False
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO user_notify_prefs (user_hash, prefs_json, updated_at)
                VALUES (?, ?, datetime('now','localtime'))
                ON CONFLICT(user_hash) DO UPDATE SET
                    prefs_json = excluded.prefs_json,
                    updated_at = excluded.updated_at
            """, (user_hash, json.dumps(prefs, ensure_ascii=False)))
            conn.commit()
            return True
    except Exception as e:
        app.logger.error(f"Errore salvataggio user_notify_prefs per {user_hash}: {e}")
        return False


def hash_user(user: str) -> str:
    if not user:
        return ""
    return hashlib.sha256(str(user).encode('utf-8')).hexdigest()[:20]


def get_cached_user_data(user_hash):
    """
    Recupera data (decodificato da JSON a dizionario Python) e last_sync.
    Restituisce (data_dict, last_sync) oppure (None, 0) se l'utente non è presente.
    """
    if not user_hash:
        return None, 0
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT data, last_sync FROM user_data WHERE user_hash = ?",
                (user_hash,)
            ).fetchone()
            if row:
                data_dict = json.loads(row["data"])
                last_sync = float(row["last_sync"])
                return data_dict, last_sync
    except Exception as e:
        app.logger.error(f"Errore recupero user_data per {user_hash}: {e}")
    return None, 0


def save_user_data(user_hash, data_dict):
    """
    Esegue un INSERT ... ON CONFLICT(user_hash) DO UPDATE
    salvando il dizionario serializzato in JSON e il timestamp corrente.
    """
    if not user_hash or not data_dict:
        return False
    try:
        now = time.time()
        json_data = json.dumps(data_dict, ensure_ascii=False)
        with get_db() as conn:
            conn.execute("""
                INSERT INTO user_data (user_hash, data, last_sync)
                VALUES (?, ?, ?)
                ON CONFLICT(user_hash) DO UPDATE SET
                    data = excluded.data,
                    last_sync = excluded.last_sync
            """, (user_hash, json_data, now))
            conn.commit()
        return True
    except Exception as e:
        app.logger.error(f"Errore salvataggio user_data per {user_hash}: {e}")
        return False


def get_user_cached_or_db_data(user):
    """
    Recupera i dati dello studente cercando prima in GLOBAL_CACHE (RAM),
    poi nella tabella user_data di SQLite (Database).
    Restituisce (data_dict, last_sync) oppure (None, 0).
    """
    if not user:
        return None, 0
    if user in GLOBAL_CACHE:
        cached = GLOBAL_CACHE[user]
        last_sync = cached.get("last_sync", cached.get("timestamp", 0))
        return cached, last_sync

    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    cached_db, last_sync = get_cached_user_data(user_hash)
    if cached_db:
        GLOBAL_CACHE[user] = cached_db
        return cached_db, last_sync
    return None, 0


def fetch_data_sequential(api):
    # Esegue in modo rigorosamente sequenziale per non invalidare la current_key
    now = time.time()
    data = {"utente": api.data_session.get("user_info", {})}
    for key, fetch_fn in [
        ("voti", api.prendi_voti),
        ("agenda", api.get_agenda),
        ("argomenti", api.get_argomenti_compiti),
        ("assenze", api.get_assenze),
        ("note", api.get_note),
        ("notizie", api.get_notizie),
        ("orario", api.get_orario),
        ("corsi", api.get_corsi),
        ("badge", api.get_badge),
    ]:
        try:
            data[key] = fetch_fn()
        except Exception as ex:
            app.logger.error(f"[FETCH] Errore recupero {key}: {ex}")
            data[key] = []
    data["timestamp"] = now
    data["last_sync"] = now
    return data

def _clean_onesignal_val(val: str) -> str:
    if not val:
        return ""
    v = val.strip().strip("'").strip('"')
    if v.lower().startswith("authorization:"):
        v = v.split(":", 1)[1].strip()
    for prefix in ("key ", "bearer ", "basic "):
        if v.lower().startswith(prefix):
            v = v[len(prefix):].strip()
    return v

def _execute_onesignal_request(url: str, payload: dict, rest_key: str):
    """
    Invia la richiesta a OneSignal provando i vari schemi di autorizzazione supportati (Key, Basic, Bearer)
    e provando sia il nuovo endpoint api.onesignal.com che onesignal.com.
    """
    clean_k = _clean_onesignal_val(rest_key)
    if not clean_k:
        return None

    # Ordine di preferenza in base al prefisso della chiave
    if clean_k.startswith("os_v2_"):
        auth_variants = [f"Key {clean_k}", f"Bearer {clean_k}", f"Basic {clean_k}"]
    else:
        auth_variants = [f"Basic {clean_k}", f"Key {clean_k}", f"Bearer {clean_k}"]

    endpoints = [url]
    if "api.onesignal.com" not in url:
        endpoints.append("https://api.onesignal.com/notifications")
    else:
        endpoints.append("https://onesignal.com/api/v1/notifications")

    last_res = None
    for ep in endpoints:
        for auth_h in auth_variants:
            try:
                headers = {
                    "Authorization": auth_h,
                    "Content-Type": "application/json; charset=utf-8"
                }
                res = requests.post(ep, headers=headers, json=payload, timeout=10)
                if res.status_code in (200, 201):
                    return res
                last_res = res
            except Exception as ex:
                app.logger.warning(f"[PUSH TRY] Errore connessione a {ep} con {auth_h[:8]}...: {ex}")

    return last_res

NAMESPACE_EDUTRACK_NOTIF = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')

def get_item_category(cat: str, itm: dict = None) -> str:
    if cat == "argomenti":
        return "compito" if (itm and itm.get("tipo") == "assegnazione") else "argomento"
    mapping = {
        "voti": "voto",
        "agenda": "agenda",
        "notizie": "notizia",
        "assenze": "assenza",
        "note": "nota"
    }
    return mapping.get(cat, cat)

def build_item_key(user_hash: str, category: str, itm: dict) -> str:
    if not isinstance(itm, dict):
        return ""
    if category == "voto":
        return f"{user_hash}:voto:{itm.get('materia', '').strip()}:{itm.get('data', '').strip()}:{str(itm.get('voto', '')).strip()}:{itm.get('descrizione', '').strip()}"
    elif category == "compito":
        return f"{user_hash}:compito:{itm.get('materia', '').strip()}:{itm.get('data', '').strip()}:{itm.get('contenuto', '').strip()}"
    elif category == "argomento":
        return f"{user_hash}:argomento:{itm.get('materia', '').strip()}:{itm.get('data', '').strip()}:{itm.get('contenuto', '').strip()}:{itm.get('docente', '').strip()}"
    elif category == "agenda":
        return f"{user_hash}:agenda:{itm.get('data', '').strip()}:{itm.get('titolo', '').strip()}:{itm.get('orario', '').strip()}:{itm.get('docente', '').strip()}"
    elif category == "notizia":
        nid = str(itm.get('id_tread') or itm.get('id') or itm.get('oggetto', '')).strip()
        return f"{user_hash}:notizia:{nid}:{itm.get('data', '').strip()}"
    elif category == "assenza":
        return f"{user_hash}:assenza:{itm.get('data', '').strip()}:{itm.get('tipo', '').strip()}:{itm.get('descrizione', '').strip()}"
    elif category == "nota":
        return f"{user_hash}:nota:{itm.get('contenuto', '').strip()}"
    return ""

def build_item_uuid(item_key: str) -> str:
    return str(uuid.uuid5(NAMESPACE_EDUTRACK_NOTIF, item_key))

ITALIAN_MONTHS_MAP = {
    'gen': 1, 'gennaio': 1,
    'feb': 2, 'febbraio': 2,
    'mar': 3, 'marzo': 3,
    'apr': 4, 'aprile': 4,
    'mag': 5, 'maggio': 5,
    'giu': 6, 'giugno': 6,
    'lug': 7, 'luglio': 7,
    'ago': 8, 'agosto': 8,
    'set': 9, 'settembre': 9,
    'ott': 10, 'ottobre': 10,
    'nov': 11, 'novembre': 11,
    'dic': 12, 'dicembre': 12
}

def parse_item_date(data_str: str):
    if not data_str:
        return None
    s = str(data_str).strip().lower()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%y'):
        try:
            m = re.search(r'\d{1,4}[/-]\d{1,2}[/-]\d{2,4}', s)
            if m:
                return datetime.strptime(m.group(0), fmt).date()
        except ValueError:
            pass
    m = re.search(r'(\d{1,2})\s+([a-z]{3,9})', s)
    if m:
        try:
            day = int(m.group(1))
            mon_str = m.group(2)
            month = ITALIAN_MONTHS_MAP.get(mon_str)
            if month:
                today = datetime.now().date()
                year = today.year
                d = datetime(year, month, day).date()
                if (d - today).days > 180:
                    d = datetime(year - 1, month, day).date()
                return d
        except Exception:
            pass
    return None

def is_item_too_old(data_str: str, max_days: int = 14) -> bool:
    if not data_str:
        return False
    d = parse_item_date(data_str)
    if not d:
        return False
    today = datetime.now().date()
    return d < (today - timedelta(days=max_days))

def is_notification_already_sent(user_hash: str, item_key: str, in_memory_keys: set = None) -> bool:
    if in_memory_keys and item_key in in_memory_keys:
        return True
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT 1 FROM sent_notifications WHERE item_key = ? OR notification_id = ?",
                (item_key, item_key)
            ).fetchone()
            if row:
                return True
    except Exception as e:
        app.logger.warning(f"Errore verifica sent_notifications: {e}")
    return False

def mark_notification_sent(user_hash: str, notification_id: str, category: str, item_key: str, title: str):
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO sent_notifications (notification_id, user_hash, category, item_key, title, sent_at)
                VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
            """, (notification_id, user_hash, category, item_key, title))
            conn.commit()
    except Exception as e:
        app.logger.warning(f"Errore registrazione sent_notification: {e}")

def send_push_notification(user_hash: str, title: str, message: str, data_payload: dict = None, idempotency_key: str = None, collapse_id: str = None):
    """
    Invia una notifica push tramite le REST API di OneSignal a un singolo utente con supporto a idempotency_key.
    """
    onesignal_app_id = _clean_onesignal_val(os.environ.get("ONESIGNAL_APP_ID", ""))
    onesignal_rest_key = _clean_onesignal_val(os.environ.get("ONESIGNAL_REST_KEY", ""))
    if not onesignal_app_id or not onesignal_rest_key:
        app.logger.warning(f"[PUSH] OneSignal non configurato (ONESIGNAL_APP_ID o ONESIGNAL_REST_KEY assenti). Notifica per {user_hash}: '{title}' - '{message}'")
        return False

    url = "https://onesignal.com/api/v1/notifications"
    payload = {
        "app_id": onesignal_app_id,
        "include_aliases": {"external_id": [user_hash]},
        "target_channel": "push",
        "headings": {"en": title, "it": title},
        "contents": {"en": message, "it": message},
        "priority": 10,
        "ttl": 259200,
        "chrome_web_badge": "/static/icons/badge-96.png"
    }
    if data_payload:
        payload["data"] = data_payload
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    if collapse_id:
        payload["collapse_id"] = collapse_id

    try:
        res = _execute_onesignal_request(url, payload, onesignal_rest_key)
        if res and res.status_code in (200, 201):
            app.logger.info(f"[PUSH] Notifica inviata con successo a {user_hash}: {title}")
            return True
        else:
            err_text = res.text if res else "Nessuna risposta"
            app.logger.error(f"[PUSH] Errore risposta OneSignal: {err_text}")
            return False
    except Exception as e:
        app.logger.error(f"[PUSH] Errore rete invio notifica OneSignal: {e}")
        return False

def send_broadcast_push_notification(title: str, message: str, url: str = None, data_payload: dict = None):
    """
    Invia una notifica push a TUTTI gli utenti registrati su OneSignal.
    """
    onesignal_app_id = _clean_onesignal_val(os.environ.get("ONESIGNAL_APP_ID", ""))
    onesignal_rest_key = _clean_onesignal_val(os.environ.get("ONESIGNAL_REST_KEY", ""))
    if not onesignal_app_id or not onesignal_rest_key:
        app.logger.warning(f"[PUSH BROADCAST] OneSignal non configurato. Notifica: '{title}' - '{message}'")
        return False, "OneSignal non configurato sul server (ONESIGNAL_APP_ID o ONESIGNAL_REST_KEY mancanti nelle Environment Variables)"

    endpoint = "https://onesignal.com/api/v1/notifications"
    payload = {
        "app_id": onesignal_app_id,
        "included_segments": ["Total Subscriptions"],
        "target_channel": "push",
        "headings": {"en": title, "it": title},
        "contents": {"en": message, "it": message},
        "priority": 10,
        "ttl": 259200,
        "chrome_web_badge": "/static/icons/badge-96.png"
    }
    if url:
        payload["url"] = url
    if data_payload:
        payload["data"] = data_payload

    try:
        res = _execute_onesignal_request(endpoint, payload, onesignal_rest_key)
        resp_data = res.json() if (res and res.content) else {}
        if res and res.status_code in (200, 201):
            recipients = resp_data.get("recipients", 0)
            app.logger.info(f"[PUSH BROADCAST] Inviata a {recipients} dispositivi: {title}")
            return True, f"Notifica inviata con successo! ({recipients} destinatari)"
        else:
            err_msg = resp_data.get("errors", [res.text if res else "Errore connessione"])
            if isinstance(err_msg, list):
                err_msg = err_msg[0]
            masked_key = f"{onesignal_rest_key[:6]}...{onesignal_rest_key[-4:] if len(onesignal_rest_key)>6 else ''} (len={len(onesignal_rest_key)})"
            app.logger.error(f"[PUSH BROADCAST] Errore OneSignal ({res.status_code if res else 'N/A'}): {err_msg}")
            return False, f"Errore OneSignal: {err_msg} [Chiave configurata: {masked_key}]"
    except Exception as e:
        app.logger.error(f"[PUSH BROADCAST] Eccezione: {e}")
        return False, f"Errore di rete: {str(e)}"


@app.route("/api/admin/broadcast", methods=["POST"])
def admin_broadcast():
    """
    Endpoint per inviare notifiche push personalizzate broadcast a tutti gli utenti.
    """
    data = request.json or {}
    secret = data.get("secret", "").strip()
    title = data.get("title", "").strip()
    message = data.get("message", "").strip()
    url = data.get("url", "").strip()
    view = data.get("view", "").strip()

    admin_pass = os.environ.get("ADMIN_PASSWORD", "Lorenzo22")
    cron_key = os.environ.get("CRON_SECRET_KEY", "")
    admin_key = os.environ.get("ADMIN_KEY", "")

    valid_keys = {k for k in (admin_pass, cron_key, admin_key, "Lorenzo22") if k}

    if not secret or secret not in valid_keys:
        return jsonify({"success": False, "error": "Password Admin non valida."}), 401

    if not title or not message:
        return jsonify({"success": False, "error": "Titolo e Messaggio sono obbligatori."}), 400

    data_payload = {"view": view} if view else None
    success, msg = send_broadcast_push_notification(title, message, url=url or None, data_payload=data_payload)

    if success:
        return jsonify({"success": True, "message": msg})
    else:
        return jsonify({"success": False, "error": msg}), 500


@app.route("/admin-push", strict_slashes=False)
@app.route("/admin-push/", strict_slashes=False)
def admin_push_page():
    return render_template("admin_push.html", app_version=APP_VERSION)


@app.route("/")
def index():
    if os.path.exists("templates/index.html"):
        onesignal_app_id = os.environ.get("ONESIGNAL_APP_ID", "")
        info = get_app_build_info()
        return render_template("index.html", app_version=info["version"], build_id=info["build_id"], onesignal_app_id=onesignal_app_id)
    return send_from_directory(".", "index.html")

@app.route("/<string:page>.html")
def serve_html_pages(page):
    filename = f"{page}.html"
    if os.path.exists(os.path.join(".", filename)):
        return send_from_directory(".", filename)
    return jsonify({"error": "Page not found"}), 404

@app.route('/sw.js')
def service_worker():
    """Serve il Service Worker con header no-cache e permessi globali per il browser."""
    response = make_response(app.send_static_file('sw.js'))
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/OneSignalSDKWorker.js')
def onesignal_worker():
    """Serve il Service Worker di OneSignal alla root del dominio."""
    response = make_response(app.send_static_file('OneSignalSDKWorker.js'))
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/api/version')
def api_version():
    """Endpoint usato dal client e Service Worker per controllare se c'è una nuova versione."""
    info = get_app_build_info()
    res = jsonify(info)
    res.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    res.headers["Pragma"] = "no-cache"
    res.headers["Expires"] = "0"
    return res

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('favicon.ico')

@app.route('/robots.txt')
def robots():
    return app.send_static_file('robots.txt')

@app.route('/sitemap.xml')
def sitemap():
    return app.send_static_file('sitemap.xml')

@app.route("/api/user/notify-preferences", methods=["GET", "POST"])
def user_notify_preferences():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    user = session['user']
    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]

    if request.method == "POST":
        data = request.json or {}
        prefs = get_user_notify_prefs(user_hash)
        for k in ("all", "voti", "compiti", "argomenti", "agenda", "notizie", "assenze", "note"):
            if k in data:
                prefs[k] = bool(data[k])
        save_user_notify_prefs(user_hash, prefs)
        return jsonify({"success": True, "preferences": prefs})

    prefs = get_user_notify_prefs(user_hash)
    return jsonify({"success": True, "preferences": prefs})

@app.route("/api/user/test-push", methods=["POST"])
def user_test_push():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    user = session['user']
    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    success = send_push_notification(
        user_hash,
        "Notifica di Prova — EduTrack",
        "Le tue notifiche push su EduTrack funzionano alla perfezione! 🎉",
        data_payload={"view": "dashboard"}
    )
    if success:
        return jsonify({"success": True, "message": "Notifica di prova inviata con successo!"})
    else:
        return jsonify({"success": False, "error": "Invio notifica fallito. Verifica i permessi o la configurazione OneSignal."}), 500

# ==============================================================================
# FIND MY TUTOR: LOGICA NORMALIZZAZIONE E GESTIONE UTENTI MASTERCOM
# ==============================================================================

def normalize_mastercom_timetable(orario_list):
    """
    Estrae e normalizza le materie scolastiche presenti nell'orario Mastercom,
    identificando la scuola (ITT o Liceo), l'anno e l'indirizzo.
    """
    EXCLUDE_KEYWORDS = {
        'EDUCAZIONE FISICA', 'RELIGIONE', 'ANIMAZIONE', 'SPORTELLO', 'RECUPERO', 'INTERVALLO'
    }
    
    SUBJECT_MAPPING = {
        'INFORMATICA': 'Informatica',
        'LETTERE ITALIANE': 'Italiano',
        'LETTERE': 'Italiano',
        'ITALIANO': 'Italiano',
        'STORIA': 'Storia',
        'MATE & COMPLEMENTI': 'Matematica',
        'MATEMATICA': 'Matematica',
        'SISTEMI E RETI': 'Sistemi e Reti',
        'TECNOLOGIE DI SISTEMI INFORMATICI': 'TPSIT',
        'TPSIT': 'TPSIT',
        'GESTIONE PROGETTO ORG. IMPRESA': 'GPOI',
        'GESTIONE PROGETTO': 'GPOI',
        'TELECOMUNICAZIONI': 'Telecomunicazioni',
        'INGLESE': 'Inglese',
        'INGLESE MADRELINGUA': 'Inglese',
        'FISICA': 'Fisica',
        'CHIMICA': 'Chimica',
        'DIRITTO': 'Diritto',
        'DIRITTO ED ECONOMIA': 'Diritto',
        'LATINO': 'Latino',
        'GRECO': 'Greco',
        'FILOSOFIA': 'Filosofia',
        'STORIA DELL\'ARTE': 'Storia dell\'Arte',
        'SCIENZE': 'Scienze',
        'SCIENZE NATURALI': 'Scienze',
        'MECCANICA': 'Meccanica',
        'DISEGNO': 'Disegno',
        'TECNOLOGIE MECCANICHE': 'Tecnologie Meccaniche',
        'ELETTROTECNICA': 'Elettrotecnica',
        'ELETTRONICA': 'Elettronica',
        'SISTEMI AUTOMATICI': 'Sistemi Automatici',
        'FISICA TECNICA': 'Fisica Tecnica',
        'IMPIANTI': 'Impianti'
    }
    
    raw_subjects = set()
    normalized_subjects = set()
    
    for item in (orario_list or []):
        m = (item.get('nome_materia_sito') or item.get('descrizione_materia') or '').strip()
        if not m:
            continue
        m_upper = m.upper()
        if any(ex in m_upper for ex in EXCLUDE_KEYWORDS):
            continue
        raw_subjects.add(m)
        
        if m_upper in SUBJECT_MAPPING:
            normalized_subjects.add(SUBJECT_MAPPING[m_upper])
        else:
            matched = False
            for k, v in SUBJECT_MAPPING.items():
                if k in m_upper:
                    normalized_subjects.add(v)
                    matched = True
                    break
            if not matched:
                clean = " ".join(w.capitalize() for w in m.split())
                normalized_subjects.add(clean)
                
    norm_list = sorted(list(normalized_subjects))
    
    school_type = "ITT"
    specialization = "Informatica"
    class_year = "4"
    
    norm_upper = [s.upper() for s in norm_list]
    if any(s in norm_upper for s in ['LATINO', 'GRECO', 'FILOSOFIA']):
        school_type = "Liceo"
        specialization = "Scientifico"
    elif any(s in norm_upper for s in ['MECCANICA', 'DISEGNO', 'TECNOLOGIE MECCANICHE']):
        school_type = "ITT"
        specialization = "Meccanica"
    elif any(s in norm_upper for s in ['ELETTRONICA', 'ELETTROTECNICA', 'SISTEMI AUTOMATICI']):
        school_type = "ITT"
        specialization = "Elettronica"
    elif any(s in norm_upper for s in ['GPOI', 'TPSIT', 'SISTEMI E RETI', 'INFORMATICA']):
        school_type = "ITT"
        specialization = "Informatica"
        if 'GPOI' in norm_upper:
            class_year = "5"
        elif 'TPSIT' in norm_upper:
            class_year = "4"
        else:
            class_year = "3"
            
    class_info = f"{class_year}° {school_type} {specialization}"
    
    return {
        "materie": norm_list,
        "raw_materie": sorted(list(raw_subjects)),
        "school_type": school_type,
        "specialization": specialization,
        "class_year": class_year,
        "class_info": class_info
    }


# ── Algoritmo di corrispondenza nomi e account (Unificazione Mastercom + Google) ──
def normalize_name_tokens(name_str):
    if not name_str:
        return set()
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', str(name_str).lower())
    clean = re.sub(r'[^a-z0-9\s]', ' ', nfkd)
    return set(t for t in clean.split() if len(t) > 1)

def names_or_email_match(name1, name2, email2=''):
    """
    Riconosce se due account appartengono alla stessa persona confrontando
    Nome e Cognome indipendentemente dall'ordine (es. 'RUSCICA Lorenzo' == 'Lorenzo Ruscica')
    e/o confrontando con il prefisso dell'email istituzionale (es. 'lorenzo.ruscica@...').
    """
    t1 = normalize_name_tokens(name1)
    t2 = normalize_name_tokens(name2)
    if t1 and t2:
        if t1 == t2:
            return True
        if (len(t1) >= 2 and t1.issubset(t2)) or (len(t2) >= 2 and t2.issubset(t1)):
            return True
    if email2:
        e_prefix = email2.split('@')[0]
        te = normalize_name_tokens(e_prefix)
        if t1 and te:
            if t1 == te:
                return True
            if (len(t1) >= 2 and t1.issubset(te)) or (len(te) >= 2 and t1.issubset(te)):
                return True
    return False


def get_or_create_fmt_user(username, password, api=None):
    """
    Autentica con Mastercom e crea/aggiorna il profilo studente nel database (fmt_users).
    Se rileva un account abbinato con stesso Nome e Cognome (es. Google Workspace),
    li unifica automaticamente condividendo permessi, ruoli e prenotazioni.
    """
    user_hash = hashlib.sha256(username.encode()).hexdigest()[:20]
    user_id = f"mc_{username}"
    
    # 1. Controlla se abbiamo gia' i dati salvati e recenti nel database
    try:
        with get_db() as conn:
            row = conn.execute("SELECT * FROM fmt_users WHERE username = ?", (username,)).fetchone()
            if row:
                row = dict(row)
            
        now = time.time()
        if row and (now - (row["last_sync"] or 0)) < 1800 and not api:
            materie = json.loads(row["materie"]) if row["materie"] else []
            orario = json.loads(row["orario"]) if row["orario"] else []
            gid = row.get("google_id")
            return {
                "id": gid or row["id"],
                "google_id": gid,
                "username": row["username"],
                "full_name": row["full_name"],
                "email": row.get("google_email") or row["email"],
                "avatar_url": row["avatar_url"],
                "role": row["role"],
                "school_type": row["school_type"],
                "class_year": row["class_year"],
                "class_info": row["class_info"],
                "materie": materie,
                "orario": orario,
                "auth_provider": "unified" if gid else "mastercom",
                "linked": bool(gid),
                "last_sync": row["last_sync"]
            }
    except Exception as e:
        app.logger.warning(f"Errore lettura fmt_users: {e}")
        
    # 2. Richiedi login live a Mastercom se api non e' gia' connessa
    if api is None:
        api = MastercomAPI(username, password)
        if not api.login():
            return None
            
    user_info = api.data_session.get("user_info", {})
    full_name = user_info.get("name", f"Studente {username}")
    avatar_url = user_info.get("foto") or "https://via.placeholder.com/150"
    
    orario = []
    try:
        orario = api.get_orario() or []
    except Exception as e:
        app.logger.warning(f"Errore recupero orario Mastercom: {e}")
        
    parsed = normalize_mastercom_timetable(orario)
    email = f"{username}@istitutoagnelli.it"
    now = time.time()

    # 3. Controllo unificazione automatica: cerca account Google/preesistente con stesso Nome e Cognome
    linked_google_id = None
    linked_google_email = None
    elevated_role = "studente"
    try:
        with get_db() as conn:
            all_users = [dict(u) for u in conn.execute("SELECT * FROM fmt_users WHERE username != ?", (username,)).fetchall()]
            for u in all_users:
                u_email = u.get("google_email") or u.get("email", "")
                if names_or_email_match(full_name, u["full_name"], u_email):
                    linked_google_id = u.get("google_id") or (u["id"] if not u["id"].startswith("mc_") else None)
                    linked_google_email = u.get("google_email") or (u_email if "@" in u_email and not u_email.startswith(username) else None)
                    u_role = u.get("role") or "studente"
                    if u_role in ("admin", "tutor"):
                        elevated_role = u_role
                    app.logger.info(f"Account unificato per corrispondenza nominativo: {full_name} <-> {u['full_name']}")
                    break
    except Exception as e:
        app.logger.warning(f"Errore scansione unificazione account: {e}")

    if linked_google_email:
        email = linked_google_email
    
    # 4. Salva nel DB (crea account se nuovo, aggiorna se esistente)
    try:
        with get_db() as conn:
            conn.execute("""
                INSERT INTO fmt_users (
                    id, username, password_hash, full_name, email, avatar_url, role,
                    school_type, class_year, class_info, materie, raw_materie, orario,
                    google_id, google_email, last_sync
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    full_name = excluded.full_name,
                    email = excluded.email,
                    avatar_url = excluded.avatar_url,
                    school_type = excluded.school_type,
                    class_year = excluded.class_year,
                    class_info = excluded.class_info,
                    materie = excluded.materie,
                    raw_materie = excluded.raw_materie,
                    orario = excluded.orario,
                    google_id = COALESCE(excluded.google_id, fmt_users.google_id),
                    google_email = COALESCE(excluded.google_email, fmt_users.google_email),
                    role = CASE WHEN excluded.role IN ('admin', 'tutor') THEN excluded.role ELSE fmt_users.role END,
                    last_sync = excluded.last_sync
            """, (
                user_id, username, hashlib.sha256(password.encode()).hexdigest(),
                full_name, email, avatar_url, elevated_role,
                parsed["school_type"], parsed["class_year"], parsed["class_info"],
                json.dumps(parsed["materie"], ensure_ascii=False),
                json.dumps(parsed["raw_materie"], ensure_ascii=False),
                json.dumps(orario, ensure_ascii=False),
                linked_google_id, linked_google_email,
                now
            ))
            conn.commit()
            
            # Mantieni ruolo attuale se gia' tutor o admin
            updated_raw = conn.execute("SELECT role, google_id, google_email FROM fmt_users WHERE username = ?", (username,)).fetchone()
            updated_row = dict(updated_raw) if updated_raw else {}
            role = updated_row.get("role") or elevated_role
            if updated_row.get("google_id"):
                linked_google_id = updated_row["google_id"]
            if updated_row.get("google_email"):
                linked_google_email = updated_row["google_email"]
                email = linked_google_email
    except Exception as e:
        app.logger.error(f"Errore salvataggio fmt_users: {e}")
        role = elevated_role
        
    return {
        "id": linked_google_id or user_id,
        "google_id": linked_google_id,
        "username": username,
        "full_name": full_name,
        "email": email,
        "avatar_url": avatar_url,
        "role": role,
        "school_type": parsed["school_type"],
        "class_year": parsed["class_year"],
        "class_info": parsed["class_info"],
        "materie": parsed["materie"],
        "orario": orario,
        "auth_provider": "unified" if linked_google_id else "mastercom",
        "linked": bool(linked_google_id),
        "last_sync": now
    }


# ==============================================================================
# FIND MY TUTOR: CRITTOGRAFIA TOKEN, RATE LIMITING E PROTEZIONE ENDPOINTS
# ==============================================================================

FMT_TOKEN_SECRET = os.environ.get("FMT_TOKEN_SECRET", app.secret_key)
LOGIN_ATTEMPTS = {}

def is_rate_limited(key, max_attempts=8, window_sec=300):
    now = time.time()
    attempts = LOGIN_ATTEMPTS.get(key, [])
    attempts = [t for t in attempts if now - t < window_sec]
    LOGIN_ATTEMPTS[key] = attempts
    return len(attempts) >= max_attempts

def record_login_attempt(key):
    now = time.time()
    attempts = LOGIN_ATTEMPTS.get(key, [])
    attempts = [t for t in attempts if now - t < 300]
    attempts.append(now)
    LOGIN_ATTEMPTS[key] = attempts

def create_fmt_token(user_id, username, role, expires_days=30):
    """Genera un token firmato con HMAC-SHA256 e scadenza."""
    payload = {
        "uid": str(user_id),
        "usr": str(username),
        "r": str(role),
        "exp": int(time.time()) + (expires_days * 86400)
    }
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode('utf-8')
    b64_payload = base64.urlsafe_b64encode(payload_json).decode('utf-8').rstrip('=')
    sig = hmac.new(FMT_TOKEN_SECRET.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"

def verify_fmt_token(token_str):
    """Verifica crittograficamente la firma e la validita' del token."""
    if not token_str or not isinstance(token_str, str) or '.' not in token_str:
        return None
    try:
        parts = token_str.strip().split('.')
        if len(parts) != 2:
            return None
        b64_payload, sig = parts
        expected_sig = hmac.new(FMT_TOKEN_SECRET.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        
        padding = 4 - (len(b64_payload) % 4)
        if padding != 4:
            b64_payload += '=' * padding
        payload_json = base64.urlsafe_b64decode(b64_payload.encode('utf-8')).decode('utf-8')
        payload = json.loads(payload_json)
        
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def get_current_fmt_user_from_request():
    """Estrae e valida l'utente autenticato dalla richiesta (Header, Cookie o Sessione)."""
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.headers.get("X-FMT-Token") or request.cookies.get("fmt_token")
    if not token:
        token = session.get("fmt_token")
        
    payload = verify_fmt_token(token)
    user_id = None
    username = None
    if payload:
        user_id = payload.get("uid")
        username = payload.get("usr")
    elif 'user' in session:
        username = session.get('user')
        
    if not username and not user_id:
        return None
        
    try:
        with get_db() as conn:
            if user_id and username:
                row = conn.execute("SELECT * FROM fmt_users WHERE id = ? OR google_id = ? OR username = ?", (user_id, user_id, username)).fetchone()
            elif user_id:
                row = conn.execute("SELECT * FROM fmt_users WHERE id = ? OR google_id = ?", (user_id, user_id)).fetchone()
            else:
                row = conn.execute("SELECT * FROM fmt_users WHERE username = ?", (username,)).fetchone()
                
        if not row:
            return None
        row = dict(row)
            
        materie = json.loads(row["materie"]) if row["materie"] else []
        orario = json.loads(row["orario"]) if row["orario"] else []
        gid = row.get("google_id")
        return {
            "id": gid or row["id"],
            "google_id": gid,
            "username": row["username"],
            "full_name": row["full_name"],
            "email": row.get("google_email") or row["email"],
            "avatar_url": row["avatar_url"],
            "role": row["role"] or "studente",
            "school_type": row["school_type"],
            "class_year": row["class_year"],
            "class_info": row["class_info"],
            "materie": materie,
            "orario": orario,
            "auth_provider": "unified" if gid else "mastercom",
            "linked": bool(gid),
            "last_sync": row["last_sync"]
        }
    except Exception as e:
        app.logger.warning(f"Errore get_current_fmt_user: {e}")
        return None

def fmt_auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_fmt_user_from_request()
        if not user:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Sessione non valida o scaduta. Effettua l'accesso con le credenziali Mastercom."
            }), 401
        request.current_fmt_user = user
        return f(*args, **kwargs)
    return decorated

def fmt_role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(request, 'current_fmt_user', None)
            if not user:
                user = get_current_fmt_user_from_request()
            if not user:
                return jsonify({
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Accesso non autorizzato."
                }), 401
            request.current_fmt_user = user
            if user.get("role") not in allowed_roles:
                return jsonify({
                    "success": False,
                    "error": "FORBIDDEN",
                    "message": f"Accesso negato. Questa operazione richiede privilegi: {', '.join(allowed_roles)}."
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ==============================================================================
# ENDPOINT FIND MY TUTOR: AUTENTICAZIONE E GESTIONE PROFILO
# ==============================================================================

@app.route("/api/mastercom/login", methods=["POST"])
@app.route("/api/fmt/login", methods=["POST"])
def fmt_mastercom_login():
    data = request.json or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    
    if not username or not password:
        return jsonify({"success": False, "message": "Codice studente e password richiesti."}), 400
        
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
    attempt_key = f"{client_ip}_{username}"
    
    # Protezione Rate Limiting contro attacchi brute force
    if is_rate_limited(attempt_key, max_attempts=8, window_sec=300):
        return jsonify({
            "success": False,
            "error": "RATE_LIMITED",
            "message": "Troppi tentativi di accesso falliti. Per motivi di sicurezza, attendi 5 minuti prima di riprovare."
        }), 429

    try:
        user_hash = hashlib.sha256(username.encode()).hexdigest()[:20]
        
        # 1. Controlla prima se abbiamo le credenziali in push_subscribers per login rapido
        saved_pass = None
        with get_db() as conn:
            p_row = conn.execute("SELECT password FROM push_subscribers WHERE user_hash = ?", (user_hash,)).fetchone()
            if p_row:
                saved_pass = p_row["password"]
                
        api = None
        if not saved_pass or saved_pass != password:
            api = MastercomAPI(username, password)
            if not api.login():
                record_login_attempt(attempt_key)
                return jsonify({
                    "success": False,
                    "error": "INVALID_CREDENTIALS",
                    "message": "Credenziali Mastercom non corrette o servizio registro temporaneamente non raggiungibile."
                }), 401
                
        session.permanent = True
        session['user'] = username
        session['password'] = password
        if api:
            GLOBAL_API[username] = api
            
        # 2. Crea o aggiorna profilo studente nel database
        user_profile = get_or_create_fmt_user(username, password, api=api)
        if not user_profile:
            return jsonify({"success": False, "message": "Impossibile recuperare i dati studente da Mastercom."}), 500
            
        # Salva credenziali per notifiche / sync
        try:
            with get_db() as conn:
                conn.execute("""
                    INSERT INTO push_subscribers (user_hash, username, password, updated_at)
                    VALUES (?, ?, ?, datetime('now','localtime'))
                    ON CONFLICT(user_hash) DO UPDATE SET
                        username = excluded.username,
                        password = excluded.password,
                        updated_at = excluded.updated_at
                """, (user_hash, username, password))
                conn.commit()
        except Exception:
            pass
            
        # Genera token crittograficamente sicuro con HMAC-SHA256
        token = create_fmt_token(user_profile['id'], user_profile['username'], user_profile['role'])
        session['fmt_token'] = token
        
        resp = make_response(jsonify({
            "success": True,
            "message": f"Benvenuto, {user_profile['full_name']}!",
            "user": user_profile,
            "token": token
        }))
        resp.set_cookie("fmt_token", token, max_age=30*86400, httponly=False, samesite="Lax")
        return resp
    except Exception as e:
        app.logger.error(f"Errore durante fmt_mastercom_login: {e}")
        return jsonify({"success": False, "message": f"Errore interno del server: {str(e)}"}), 500


@app.route("/api/fmt/sync_google_account", methods=["POST"])
def fmt_sync_google_account():
    """
    Unifica l'account Google con il profilo Registro Elettronico (Mastercom)
    quando nome e cognome corrispondono (es. 'RUSCICA Lorenzo' == 'Lorenzo Ruscica').
    Garantisce che lo stesso studente abbia la medesima identità, ruoli, e prenotazioni.
    """
    data = request.json or {}
    google_id = str(data.get("id", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    full_name = str(data.get("full_name", "")).strip()
    role = str(data.get("role", "studente")).strip().lower()
    avatar_url = str(data.get("avatar_url", "")).strip()

    if not google_id or not full_name:
        return jsonify({"success": False, "message": "ID Google e Nominativo obbligatori."}), 400

    now = time.time()
    try:
        with get_db() as conn:
            rows = [dict(r) for r in conn.execute("SELECT * FROM fmt_users").fetchall()]
            matched_row = None
            for r in rows:
                r_email = r.get("google_email") or r.get("email", "")
                if names_or_email_match(r["full_name"], full_name, email) or (r.get("google_id") == google_id):
                    matched_row = r
                    break

            if matched_row:
                mc_username = matched_row["username"]
                # Il ruolo unificato privilegia admin > tutor > studente
                final_role = matched_row["role"] if matched_row["role"] in ("admin", "tutor") else role
                if final_role not in ("admin", "tutor"):
                    final_role = "studente"

                conn.execute("""
                    UPDATE fmt_users 
                    SET google_id = ?, google_email = ?, role = ?, last_sync = ?
                    WHERE username = ?
                """, (google_id, email, final_role, now, mc_username))
                conn.commit()

                updated_raw = conn.execute("SELECT * FROM fmt_users WHERE username = ?", (mc_username,)).fetchone()
                updated = dict(updated_raw) if updated_raw else {}
                materie = json.loads(updated["materie"]) if updated.get("materie") else []
                orario = json.loads(updated["orario"]) if updated.get("orario") else []

                token = create_fmt_token(google_id, updated["username"], final_role)
                session['fmt_token'] = token
                session['user'] = updated["username"]

                user_obj = {
                    "id": google_id,
                    "google_id": google_id,
                    "username": updated["username"],
                    "full_name": updated["full_name"],
                    "email": email,
                    "google_email": email,
                    "avatar_url": updated["avatar_url"] or avatar_url,
                    "role": final_role,
                    "school_type": updated["school_type"],
                    "class_year": updated["class_year"],
                    "class_info": updated["class_info"],
                    "materie": materie,
                    "orario": orario,
                    "auth_provider": "unified",
                    "linked": True,
                    "last_sync": now
                }
                resp = make_response(jsonify({
                    "success": True,
                    "message": f"Account unificato con successo per {updated['full_name']}!",
                    "user": user_obj,
                    "token": token
                }))
                resp.set_cookie("fmt_token", token, max_age=30*86400, httponly=False, samesite="Lax")
                return resp
            else:
                # Salva placeholder per quando lo studente farà accesso da Registro in futuro
                user_hash = hashlib.sha256(google_id.encode()).hexdigest()[:15]
                fake_username = f"g_{user_hash}"
                conn.execute("""
                    INSERT INTO fmt_users (
                        id, username, full_name, email, google_id, google_email, avatar_url, role, last_sync
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(username) DO UPDATE SET
                        full_name = excluded.full_name,
                        email = excluded.email,
                        google_id = excluded.google_id,
                        google_email = excluded.google_email,
                        role = excluded.role,
                        last_sync = excluded.last_sync
                """, (google_id, fake_username, full_name, email, google_id, email, avatar_url, role, now))
                conn.commit()

                token = create_fmt_token(google_id, fake_username, role)
                session['fmt_token'] = token

                user_obj = {
                    "id": google_id,
                    "google_id": google_id,
                    "username": fake_username,
                    "full_name": full_name,
                    "email": email,
                    "google_email": email,
                    "avatar_url": avatar_url,
                    "role": role,
                    "materie": [],
                    "orario": [],
                    "auth_provider": "google",
                    "linked": False,
                    "last_sync": now
                }
                resp = make_response(jsonify({
                    "success": True,
                    "message": f"Benvenuto, {full_name}!",
                    "user": user_obj,
                    "token": token
                }))
                resp.set_cookie("fmt_token", token, max_age=30*86400, httponly=False, samesite="Lax")
                return resp
    except Exception as e:
        app.logger.error(f"Errore durante sync_google_account: {e}")
        return jsonify({"success": False, "message": f"Errore interno del server: {str(e)}"}), 500


@app.route("/api/fmt/me", methods=["GET"])
@fmt_auth_required
def fmt_get_me():
    """Restituisce il profilo verificato dell'utente dal token di sessione autenticato."""
    return jsonify({
        "success": True,
        "user": request.current_fmt_user
    })


@app.route("/api/fmt/logout", methods=["POST", "GET"])
def fmt_logout():
    """Termina la sessione corrente in modo sicuro."""
    session.pop("fmt_token", None)
    session.pop("user", None)
    session.pop("password", None)
    resp = make_response(jsonify({"success": True, "message": "Disconnessione effettuata con successo."}))
    resp.set_cookie("fmt_token", "", expires=0)
    return resp


@app.route("/api/fmt/sync", methods=["POST"])
@fmt_auth_required
def fmt_sync_profile():
    current_user = request.current_fmt_user
    username = current_user["username"]
    password = session.get("password")
    
    if not password:
        user_hash = hashlib.sha256(str(username).encode()).hexdigest()[:20]
        with get_db() as conn:
            row = conn.execute("SELECT password FROM push_subscribers WHERE user_hash = ?", (user_hash,)).fetchone()
            if row:
                password = row["password"]
                
    if not password:
        return jsonify({"success": False, "message": "Password non disponibile per la sincronizzazione."}), 400
        
    api = MastercomAPI(username, password)
    if not api.login():
        return jsonify({"success": False, "message": "Connessione a Mastercom fallita."}), 401
        
    user_profile = get_or_create_fmt_user(username, password, api=api)
    return jsonify({
        "success": True,
        "message": "Orario, materie e foto sincronizzati con successo dal Registro Elettronico!",
        "user": user_profile
    })


@app.route("/api/fmt/user", methods=["GET"])
def fmt_get_user():
    # Permette verifica con sessione autenticata o per username con restrizione
    current = get_current_fmt_user_from_request()
    target_username = request.args.get("username")
    
    if not target_username:
        if current:
            return jsonify({"success": True, "user": current})
        return jsonify({"success": False, "message": "Utente non specificato."}), 400
        
    with get_db() as conn:
        row = conn.execute("SELECT * FROM fmt_users WHERE username = ?", (target_username,)).fetchone()
        if not row:
            return jsonify({"success": False, "message": "Utente non trovato."}), 404
            
        materie = json.loads(row["materie"]) if row["materie"] else []
        orario = json.loads(row["orario"]) if row["orario"] else []
        return jsonify({
            "success": True,
            "user": {
                "id": row["id"],
                "username": row["username"],
                "full_name": row["full_name"],
                "email": row["email"],
                "avatar_url": row["avatar_url"],
                "role": row["role"],
                "school_type": row["school_type"],
                "class_year": row["class_year"],
                "class_info": row["class_info"],
                "materie": materie,
                "orario": orario,
                "auth_provider": "mastercom",
                "last_sync": row["last_sync"]
            }
        })


@app.route("/api/fmt/tutors", methods=["GET"])
def fmt_get_tutors():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM fmt_tutors").fetchall()
        tutors = []
        for r in rows:
            tutors.append({
                "id": r["id"],
                "full_name": r["full_name"],
                "email": r["email"],
                "class_info": r["class_info"],
                "subjects": r["subjects"],
                "availability": r["availability"],
                "avatar_url": r["avatar_url"],
                "rating": r["rating"],
                "rating_count": r["rating_count"],
                "role": "tutor"
            })
    return jsonify({"success": True, "tutors": tutors})


@app.route("/api/fmt/appointments", methods=["GET", "POST"])

def calculate_room_assignment(conn, date_val, time_slot, duration, is_group, school_type):
    try:
        start_str = time_slot.split('-')[0].strip()
        h, m = map(int, start_str.split(':'))
        req_start = h * 60 + m
        dur_val = int(str(duration).replace('min', '').strip()) if str(duration).replace('min', '').strip().isdigit() else 60
        req_end = req_start + dur_val
        
        rows = conn.execute("SELECT a.room_name, a.is_group, a.time_slot, a.duration, u.school_type FROM fmt_appointments a LEFT JOIN fmt_users u ON a.user_id = u.id WHERE a.date = ? AND a.status != 'Cancellata'", (date_val,)).fetchall()
        
        rooms = {"Aula 1": [], "Aula 2": [], "Aula 3": [], "Aula 4": []}
        
        for r in rows:
            if not r['room_name'] or r['room_name'] not in rooms: continue
            
            r_start_str = r['time_slot'].split('-')[0].strip()
            rh, rm = map(int, r_start_str.split(':'))
            r_s = rh * 60 + rm
            r_d = int(str(r['duration']).replace('min', '').strip()) if str(r['duration']).replace('min', '').strip().isdigit() else 60
            r_e = r_s + r_d
            
            # Check overlap
            if req_start < r_e and req_end > r_s:
                rooms[r['room_name']].append(r)
                
        # Group takes whole room, so a room with any group lesson is full.
        # Single takes 1/4 of a room. Room is full if >= 4 singles.
        
        if is_group:
            # find first empty room
            for room_name in ["Aula 1", "Aula 2", "Aula 3", "Aula 4"]:
                if len(rooms[room_name]) == 0:
                    return room_name
            return "Nessuna aula disponibile"
        else:
            # We want to pack singles, but group by school_type if possible.
            # First, filter out full rooms and rooms with group lessons
            available_rooms = {}
            for rn, occupants in rooms.items():
                if any(o['is_group'] for o in occupants): continue
                if len(occupants) >= 4: continue
                available_rooms[rn] = occupants
                
            if not available_rooms:
                return "Nessuna aula disponibile"
                
            # Is there an empty room?
            empty_rooms = [rn for rn, occ in available_rooms.items() if len(occ) == 0]
            partially_filled = {rn: occ for rn, occ in available_rooms.items() if len(occ) > 0}
            
            # Prioritize space: try to fill partially filled rooms first.
            # Does any partially filled room have mostly our school type?
            best_room = None
            if partially_filled:
                for rn, occ in partially_filled.items():
                    # check if it matches school type
                    types = [o['school_type'] for o in occ if o['school_type']]
                    if school_type and types and types.count(school_type) > 0:
                        best_room = rn
                        break
                if not best_room:
                    # just take the first partially filled
                    best_room = list(partially_filled.keys())[0]
                return best_room
            
            # If no partially filled rooms, take the first empty room
            if empty_rooms:
                return empty_rooms[0]
                
            return "Nessuna aula disponibile"
            
    except Exception as e:
        return "Aula 1"

@app.route("/api/fmt/appointments", methods=["GET", "POST"])
def fmt_appointments():
    current_user = get_current_fmt_user_from_request()
    
    if request.method == "GET":
        if not current_user:
            # Utente ospite: restituisce lista vuota senza esporre prenotazioni altrui
            return jsonify({"success": True, "appointments": []})
            
        with get_db() as conn:
            # Raccogli tutti gli identificativi dell'utente (ID primario, Google ID, matricola mc_)
            u_ids = [current_user["id"]]
            if current_user.get("google_id") and current_user["google_id"] not in u_ids:
                u_ids.append(current_user["google_id"])
            if current_user.get("username"):
                mc_id = f"mc_{current_user['username']}"
                if mc_id not in u_ids:
                    u_ids.append(mc_id)
            placeholders = ",".join("?" for _ in u_ids)

            if current_user["role"] == "admin":
                user_id = request.args.get("user_id")
                tutor_id = request.args.get("tutor_id")
                if user_id:
                    rows = conn.execute("SELECT * FROM fmt_appointments WHERE user_id = ? ORDER BY date ASC", (user_id,)).fetchall()
                elif tutor_id:
                    rows = conn.execute("SELECT * FROM fmt_appointments WHERE tutor_id = ? ORDER BY date ASC", (tutor_id,)).fetchall()
                else:
                    rows = conn.execute("SELECT * FROM fmt_appointments ORDER BY date ASC").fetchall()
            elif current_user["role"] == "tutor":
                # Tutor vede sia le proprie lezioni da docente che le proprie prenotazioni da studente
                rows = conn.execute(f"""
                    SELECT * FROM fmt_appointments 
                    WHERE tutor_id IN ({placeholders}) OR user_id IN ({placeholders}) OR student_name = ?
                    ORDER BY date ASC
                """, (*u_ids, *u_ids, current_user["full_name"])).fetchall()
            else:
                # Studente comune: vede RIGOROSAMENTE le proprie prenotazioni (anche tra account unificati)
                rows = conn.execute(f"""
                    SELECT * FROM fmt_appointments 
                    WHERE user_id IN ({placeholders}) OR student_name = ?
                    ORDER BY date ASC
                """, (*u_ids, current_user["full_name"])).fetchall()
                
            apps = [dict(r) for r in rows]
        return jsonify({"success": True, "appointments": apps})
        
    # POST - Nuova Prenotazione (Autenticazione Obbligatoria per prevenire spoofing)
    if not current_user:
        return jsonify({
            "success": False,
            "error": "UNAUTHORIZED",
            "message": "Devi effettuare l'accesso per poter prenotare una lezione."
        }), 401
        
    data = request.json or {}
    app_id = str(uuid.uuid4())
    # Assegna tassativamente l'identità dell'utente autenticato dal token
    user_id = current_user["id"]
    student_name = current_user["full_name"]
    student_email = current_user["email"]
    
    tutor_id = str(data.get("tutor_id", "")).strip()
    subject = str(data.get("subject", "")).strip()
    date_val = str(data.get("date", "")).strip()
    time_slot = str(data.get("time_slot", "")).strip()
    duration = str(data.get("duration", "60 min")).strip()
    tutor_name_cache = str(data.get("tutor_name_cache", "")).strip()
    notes = str(data.get("notes", "")).strip()
    is_group = 1 if data.get("is_group") else 0
    group_members = str(data.get("group_members", "")).strip()
    
    if not tutor_id or not date_val or not time_slot or not subject:
        return jsonify({"success": False, "message": "Campi obbligatori mancanti (tutor, data, orario, materia)."}), 400
        
    with get_db() as conn:
        room_assign = calculate_room_assignment(conn, date_val, time_slot, duration, is_group, current_user.get('school_type'))
        conn.execute("""
            INSERT INTO fmt_appointments (
                id, user_id, tutor_id, student_name, student_email, subject,
                date, time_slot, duration, status, tutor_name_cache, notes,
                is_group, group_members, room_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confermato', ?, ?, ?, ?, ?)
        """, (app_id, user_id, tutor_id, student_name, student_email, subject,
              date_val, time_slot, duration, tutor_name_cache, notes, is_group, group_members, room_assign))
        conn.commit()
        
    return jsonify({
        "success": True,
        "message": "Lezione prenotata con successo!",
        "appointment": {
            "id": app_id,
            "user_id": user_id,
            "tutor_id": tutor_id,
            "student_name": student_name,
            "student_email": student_email,
            "subject": subject,
            "date": date_val,
            "time_slot": time_slot,
            "duration": duration,
            "status": "Confermato",
            "tutor_name_cache": tutor_name_cache,
            "notes": notes,
            "is_group": bool(is_group),
            "group_members": group_members
        }
    })


@app.route("/api/fmt/appointments/<app_id>", methods=["PUT", "DELETE"])
@fmt_auth_required
def fmt_manage_appointment(app_id):
    current_user = request.current_fmt_user
    
    # 1. Verifica proprietà della prenotazione
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM fmt_appointments WHERE id = ?", (app_id,)).fetchone()
        
    if not existing:
        return jsonify({"success": False, "message": "Prenotazione non trovata."}), 404
        
    is_owner = (existing["user_id"] == current_user["id"])
    is_assigned_tutor = (existing["tutor_id"] == current_user["id"])
    is_admin = (current_user["role"] == "admin")
    
    if not (is_owner or is_assigned_tutor or is_admin):
        return jsonify({
            "success": False,
            "error": "FORBIDDEN",
            "message": "Non sei autorizzato a modificare o cancellare questa prenotazione."
        }), 403
        
    if request.method == "PUT":
        data = request.json or {}
        date_val = data.get("date")
        time_slot = data.get("time_slot")
        notes = data.get("notes")
        duration = data.get("duration", "60 min")
        subject = data.get("subject")
        
        with get_db() as conn:
            conn.execute("""
                UPDATE fmt_appointments
                SET date = COALESCE(?, date),
                    time_slot = COALESCE(?, time_slot),
                    notes = COALESCE(?, notes),
                    duration = COALESCE(?, duration),
                    subject = COALESCE(?, subject)
                WHERE id = ?
            """, (date_val, time_slot, notes, duration, subject, app_id))
            conn.commit()
        return jsonify({"success": True, "message": "Lezione aggiornata con successo."})
        
    if request.method == "DELETE":
        data = request.json or {}
        reason = data.get("reason", f"Cancellata da {current_user['full_name']}")
        with get_db() as conn:
            conn.execute("""
                UPDATE fmt_appointments
                SET status = 'Cancellata',
                    cancellation_reason = ?
                WHERE id = ?
            """, (reason, app_id))
            conn.commit()
        return jsonify({"success": True, "message": "Lezione cancellata con successo."})


@app.route("/api/fmt/ratings", methods=["POST"])
@fmt_auth_required
def fmt_ratings():
    data = request.json or {}
    tutor_id = data.get("tutor_id")
    app_id = data.get("appointment_id")
    try:
        rating = max(1, min(5, int(data.get("rating", 5))))
    except (ValueError, TypeError):
        rating = 5
    
    if not tutor_id:
        return jsonify({"success": False, "message": "Identificativo tutor mancante."}), 400
        
    with get_db() as conn:
        conn.execute("""
            INSERT INTO fmt_ratings (id, tutor_id, appointment_id, rating)
            VALUES (?, ?, ?, ?)
        """, (str(uuid.uuid4()), tutor_id, app_id, rating))
        
        avg_row = conn.execute("""
            SELECT AVG(rating), COUNT(*) FROM fmt_ratings WHERE tutor_id = ?
        """, (tutor_id,)).fetchone()
        if avg_row and avg_row[1] > 0:
            conn.execute("""
                UPDATE fmt_tutors SET rating = ?, rating_count = ? WHERE id = ?
            """, (round(avg_row[0], 1), avg_row[1], tutor_id))
        conn.commit()
        
    return jsonify({"success": True, "message": "Grazie per la tua recensione!"})



@app.route("/api/fmt/admin/staff", methods=["GET", "POST"])
@fmt_auth_required
@fmt_role_required("admin")
def fmt_admin_staff():
    if request.method == "GET":
        with get_db() as conn:
            rows = conn.execute("SELECT id, username, full_name FROM fmt_users WHERE role = 'staff'").fetchall()
            return jsonify({"success": True, "staff": [dict(r) for r in rows]})
    else:
        data = request.json or {}
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        full_name = data.get("full_name", "").strip()
        if not username or not password or not full_name:
            return jsonify({"success": False, "message": "Dati mancanti"}), 400
        
        user_id = "staff_" + username
        pwd_hash = hashlib.sha256(password.encode()).hexdigest()
        
        with get_db() as conn:
            try:
                conn.execute("""
                    INSERT INTO fmt_users (id, username, password_hash, full_name, email, role)
                    VALUES (?, ?, ?, ?, ?, 'staff')
                """, (user_id, username, pwd_hash, full_name, username + "@staff.local"))
                conn.commit()
                return jsonify({"success": True, "message": "Staff aggiunto"})
            except sqlite3.IntegrityError:
                return jsonify({"success": False, "message": "Username già in uso"}), 400

@app.route("/api/fmt/staff/tutors", methods=["GET"])
@fmt_auth_required
@fmt_role_required("staff", "admin")
def fmt_staff_tutors():
    with get_db() as conn:
        # Get all tutors and their completed lessons
        tutors = conn.execute("SELECT t.id, t.full_name, t.fsl_acknowledged, u.class_info FROM fmt_tutors t LEFT JOIN fmt_users u ON t.id = u.id").fetchall()
        tutors_data = []
        for t in tutors:
            # calculate total hours from completed lessons
            apps = conn.execute("SELECT duration FROM fmt_appointments WHERE tutor_id = ? AND date < date('now', 'localtime') AND status != 'Cancellata'", (t['id'],)).fetchall()
            total_minutes = 0
            for a in apps:
                d_str = str(a['duration']).replace('min', '').strip()
                total_minutes += int(d_str) if d_str.isdigit() else 60
            total_hours = total_minutes / 60.0
            unacknowledged_hours = max(0, total_hours - float(t['fsl_acknowledged'] or 0))
            
            tutors_data.append({
                "id": t['id'],
                "full_name": t['full_name'],
                "class_info": t['class_info'],
                "total_fsl_hours": round(total_hours, 2),
                "unacknowledged_hours": round(unacknowledged_hours, 2),
                "fsl_acknowledged": round(float(t['fsl_acknowledged'] or 0), 2)
            })
        return jsonify({"success": True, "tutors": tutors_data})

@app.route("/api/fmt/staff/acknowledge_fsl", methods=["POST"])
@fmt_auth_required
@fmt_role_required("staff", "admin")
def fmt_staff_ack_fsl():
    data = request.json or {}
    tutor_id = data.get("tutor_id")
    hours_to_add = float(data.get("hours", 0))
    if not tutor_id or hours_to_add <= 0:
        return jsonify({"success": False, "message": "Dati non validi"}), 400
        
    with get_db() as conn:
        conn.execute("UPDATE fmt_tutors SET fsl_acknowledged = COALESCE(fsl_acknowledged, 0) + ? WHERE id = ?", (hours_to_add, tutor_id))
        conn.commit()
    return jsonify({"success": True, "message": "Ore registrate con successo"})

@app.route("/api/fmt/appointments/acknowledge_cancellation", methods=["POST"])
@fmt_auth_required
def fmt_ack_cancellation():
    data = request.json or {}
    app_id = data.get("appointment_id")
    with get_db() as conn:
        conn.execute("UPDATE fmt_appointments SET cancellation_notified = 1 WHERE id = ? AND user_id = ?", (app_id, get_current_fmt_user_from_request()["id"]))
        conn.commit()
    return jsonify({"success": True})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    user = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not user or not password:
        return jsonify({"success": False, "message": "Credenziali mancanti"}), 400

    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    cached_data, last_sync = get_cached_user_data(user_hash)

    # 1. Verifica credenziali salvate nel database locale (istantaneo ~5ms)
    is_saved = False
    try:
        with get_db() as conn:
            row = conn.execute("SELECT password FROM push_subscribers WHERE user_hash = ?", (user_hash,)).fetchone()
            if row and row["password"] == password:
                is_saved = True
    except Exception:
        pass

    if is_saved and cached_data:
        session.permanent = True
        session['user'] = user
        session['password'] = password
        GLOBAL_CACHE[user] = cached_data
        
        # Recupera o crea anche il profilo FindMyTutor
        fmt_user = get_or_create_fmt_user(user, password)
        return jsonify({
            "success": True,
            "message": "Login istantaneo!",
            "user_hash": user_hash,
            "cached": True,
            "data": cached_data,
            "user": fmt_user
        })

    # 2. Login live su Mastercom (se nuovo utente o password modificata)
    api = MastercomAPI(user, password)
    if api.login():
        session.permanent = True
        session['user'] = user
        session['password'] = password
        GLOBAL_API[user] = api

        try:
            with get_db() as conn:
                conn.execute("""
                    INSERT INTO push_subscribers (user_hash, username, password, updated_at)
                    VALUES (?, ?, ?, datetime('now','localtime'))
                    ON CONFLICT(user_hash) DO UPDATE SET
                        username = excluded.username,
                        password = excluded.password,
                        updated_at = excluded.updated_at
                """, (user_hash, user, password))
                conn.commit()
        except Exception as e:
            app.logger.error(f"Errore registrazione push_subscriber per {user_hash}: {e}")

        fmt_user = get_or_create_fmt_user(user, password, api=api)
        return jsonify({
            "success": True,
            "message": "Login effettuato!",
            "user_hash": user_hash,
            "data": cached_data if cached_data else None,
            "user": fmt_user
        })
    else:
        return jsonify({"success": False, "message": "Credenziali non valide o login fallito."}), 401

@app.route("/api/data", methods=["GET"])
def get_all_data():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    user = session['user']
    password = session['password']
    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]

    force_param = request.args.get('force', 'false').strip().lower()
    force = force_param in ('true', '1', 'yes')

    # 1. Verifica cache (RAM prima, poi Database)
    cached_data = None
    last_sync = 0

    if user in GLOBAL_CACHE:
        cached_data = GLOBAL_CACHE[user]
        last_sync = cached_data.get("last_sync", cached_data.get("timestamp", 0))
    else:
        cached_data, last_sync = get_cached_user_data(user_hash)
        if cached_data:
            GLOBAL_CACHE[user] = cached_data

    # 2. Se non è un refresh forzato (?force=true), restituisci SUBITO la cache se presente nel DB/RAM.
    # Questo rende il caricamento dell'app SEMPRE ISTANTANEO (~5ms) ed evita blocchi prolungati.
    now = time.time()
    CACHE_MAX_AGE_SECONDS = 900  # 15 minuti di validità cache
    is_fresh = (now - float(last_sync or 0)) < CACHE_MAX_AGE_SECONDS

    if cached_data and not force:
        response_data = dict(cached_data)
        response_data["source"] = "database"
        response_data["last_sync"] = last_sync
        response_data["user_hash"] = user_hash
        response_data["is_stale"] = not is_fresh
        return jsonify(response_data)

    # 3. Sincronizzazione Live (Scraping) con riutilizzo istanza MastercomAPI se già connessa
    api = GLOBAL_API.get(user)
    if api is None or not getattr(api, "data_session", None):
        api = MastercomAPI(user, password)
        if not api.login():
            GLOBAL_API.pop(user, None)
            if cached_data:
                fallback_data = dict(cached_data)
                fallback_data["source"] = "offline_fallback"
                fallback_data["warning"] = "Sessione scaduta, mostro dati salvati"
                fallback_data["last_sync"] = last_sync
                fallback_data["user_hash"] = user_hash
                return jsonify(fallback_data)
            return jsonify({"error": "Sessione scaduta"}), 401
        GLOBAL_API[user] = api

    fresh_data = fetch_data_sequential(api)
    if not fresh_data.get("utente") and cached_data:
        fresh_data["utente"] = cached_data.get("utente", {})

    now = time.time()
    fresh_data["timestamp"] = now
    fresh_data["last_sync"] = now

    # Preserva e arricchisci _sent_keys per evitare che elementi già sincronizzati vengano notificati dal cron
    sent_keys = set(cached_data.get("_sent_keys", [])) if (cached_data and isinstance(cached_data, dict)) else set()
    for cat in ("voti", "argomenti", "agenda", "notizie", "assenze", "note"):
        for itm in fresh_data.get(cat, []):
            if isinstance(itm, dict):
                c_type = get_item_category(cat, itm)
                k = build_item_key(user_hash, c_type, itm)
                if k:
                    sent_keys.add(k)
                    mark_notification_sent(user_hash, build_item_uuid(k), c_type, k, "Synced in app")
    fresh_data["_sent_keys"] = list(sent_keys)

    GLOBAL_CACHE[user] = fresh_data
    save_user_data(user_hash, fresh_data)

    response_data = dict(fresh_data)
    response_data["source"] = "live_sync"
    response_data["last_sync"] = now
    response_data["user_hash"] = user_hash
    return jsonify(response_data)


@app.route("/api/cron/check-updates", methods=["GET", "POST"])
def cron_check_updates():
    """
    Endpoint di Diffing e Polling per notifiche push automatiche in background.
    Compatibile con webhook esterni (cron-job.org, GitHub Actions, Vercel).
    """
    try:
        cron_secret = os.environ.get("CRON_SECRET_KEY", os.environ.get("CRON_SECRET", ""))
        if cron_secret:
            auth_header = request.headers.get("Authorization", "")
            x_cron_key = request.headers.get("X-Cron-Key", "")
            query_key = request.args.get("key", "")
            bearer_match = (auth_header == f"Bearer {cron_secret}" or auth_header == cron_secret)
            if x_cron_key != cron_secret and not bearer_match and query_key != cron_secret:
                return jsonify({"error": "Unauthorized"}), 401

        users_to_check = []
        req_json = request.get_json(silent=True) or {}
        
        # 1. Lettura da JSON body (se presente)
        if isinstance(req_json, dict):
            if req_json.get("username") and req_json.get("password"):
                users_to_check.append((req_json["username"].strip(), req_json["password"]))
            elif req_json.get("users"):
                for u in req_json.get("users", []):
                    if isinstance(u, dict) and u.get("username") and u.get("password"):
                        users_to_check.append((u["username"].strip(), u["password"]))

        # 2. Lettura da query params (se presente via GET)
        if not users_to_check:
            q_user = request.args.get("username", "").strip()
            q_pass = request.args.get("password", "")
            if q_user and q_pass:
                users_to_check.append((q_user, q_pass))

        # 3. Fallback: lettura degli utenti registrati nel database locale
        if not users_to_check:
            try:
                with get_db() as conn:
                    rows = conn.execute("SELECT username, password FROM push_subscribers").fetchall()
                    for r in rows:
                        if r["username"] and r["password"]:
                            users_to_check.append((r["username"], r["password"]))
            except Exception as e:
                app.logger.error(f"[CRON] Errore recupero push_subscribers: {e}")

        if not users_to_check:
            return jsonify({
                "success": True,
                "message": "Nessun utente da verificare",
                "checked": 0,
                "notifications_sent": 0,
                "notified_items": []
            })

        checked_count = 0
        notifications_count = 0
        notified_items = []
        errors = []

        for username, password in users_to_check:
            user_hash = hashlib.sha256(username.encode()).hexdigest()[:20]
            try:
                api = MastercomAPI(username, password)
                if not api.login():
                    app.logger.warning(f"[CRON] Login fallito su Mastercom per {username} ({user_hash})")
                    errors.append(f"Login fallito per {username}")
                    continue

                fresh_data = fetch_data_sequential(api)
                now = time.time()
                fresh_data["timestamp"] = now
                fresh_data["last_sync"] = now
                checked_count += 1

                old_data, _ = get_cached_user_data(user_hash)

                # Set di chiavi già notificate o viste in precedenza (deduplicazione persistente)
                old_sent_keys = set(old_data.get("_sent_keys", [])) if (old_data and isinstance(old_data, dict)) else set()
                try:
                    with get_db() as conn:
                        rows = conn.execute("SELECT item_key FROM sent_notifications WHERE user_hash = ?", (user_hash,)).fetchall()
                        for r in rows:
                            old_sent_keys.add(r[0])
                except Exception:
                    pass

                current_sent_keys = set(old_sent_keys)

                # Se old_data non esiste (primo snapshot dello studente), memorizziamo senza spammare
                if not old_data:
                    for cat in ("voti", "argomenti", "agenda", "notizie", "assenze", "note"):
                        for itm in fresh_data.get(cat, []):
                            if isinstance(itm, dict):
                                c_type = get_item_category(cat, itm)
                                k = build_item_key(user_hash, c_type, itm)
                                if k:
                                    current_sent_keys.add(k)
                                    mark_notification_sent(user_hash, build_item_uuid(k), c_type, k, "Historical seed")
                    fresh_data["_sent_keys"] = list(current_sent_keys)
                    save_user_data(user_hash, fresh_data)
                    GLOBAL_CACHE[username] = fresh_data
                    continue

                # Preferenze notifiche studente
                user_prefs = get_user_notify_prefs(user_hash)
                allow_all = user_prefs.get("all", True)
                allow_voti = allow_all and user_prefs.get("voti", True)
                allow_compiti = allow_all and user_prefs.get("compiti", True)
                allow_argomenti = allow_all and user_prefs.get("argomenti", True)
                allow_agenda = allow_all and user_prefs.get("agenda", True)
                allow_notizie = allow_all and user_prefs.get("notizie", True)
                allow_assenze = allow_all and user_prefs.get("assenze", True)
                allow_note = allow_all and user_prefs.get("note", True)

                # 1. Diffing Voti
                old_voti = old_data.get("voti", [])
                old_voti_set = {
                    (
                        v.get("materia", ""),
                        v.get("data", ""),
                        str(v.get("voto", "")),
                        v.get("descrizione", "")
                    )
                    for v in old_voti if isinstance(v, dict)
                }

                new_voti = fresh_data.get("voti", [])
                for v in new_voti:
                    if not isinstance(v, dict):
                        continue
                    v_key = (
                        v.get("materia", ""),
                        v.get("data", ""),
                        str(v.get("voto", "")),
                        v.get("descrizione", "")
                    )
                    item_key = build_item_key(user_hash, "voto", v)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se la data è vecchia (> 14 giorni), archivia senza inviare push
                    if is_item_too_old(v.get("data", "")):
                        mark_notification_sent(user_hash, item_uuid, "voto", item_key, "Archived old vote")
                        current_sent_keys.add(item_key)
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if v_key in old_voti_set:
                        mark_notification_sent(user_hash, item_uuid, "voto", item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if v_key not in old_voti_set:
                        materia = v.get("materia", "Materia")
                        voto_val = str(v.get("voto", ""))
                        desc = v.get("descrizione", "").strip()
                        title = f"Nuovo Voto - {materia}"
                        message = f"Hai ricevuto {voto_val} in {materia}" + (f" ({desc})" if desc else "")
                        
                        if allow_voti:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "voti", "materia": materia},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_voto"
                            )
                            notifications_count += 1
                        
                        mark_notification_sent(user_hash, item_uuid, "voto", item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": "voto",
                            "user_hash": user_hash,
                            "materia": materia,
                            "voto": voto_val,
                            "sent": allow_voti
                        })

                # 2. Diffing Compiti & Argomenti
                old_argomenti = old_data.get("argomenti", [])
                old_argomenti_set = {
                    (
                        a.get("materia", ""),
                        a.get("data", ""),
                        a.get("contenuto", ""),
                        a.get("tipo", "")
                    )
                    for a in old_argomenti if isinstance(a, dict)
                }

                new_argomenti = fresh_data.get("argomenti", [])
                for a in new_argomenti:
                    if not isinstance(a, dict):
                        continue
                    tipo_arg = a.get("tipo", "argomento")
                    a_key = (
                        a.get("materia", ""),
                        a.get("data", ""),
                        a.get("contenuto", ""),
                        tipo_arg
                    )
                    category_name = "compito" if tipo_arg == "assegnazione" else "argomento"
                    item_key = build_item_key(user_hash, category_name, a)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se la data è vecchia (> 14 giorni), archivia senza inviare push
                    if is_item_too_old(a.get("data", "")):
                        mark_notification_sent(user_hash, item_uuid, category_name, item_key, "Archived old assignment")
                        current_sent_keys.add(item_key)
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if a_key in old_argomenti_set:
                        mark_notification_sent(user_hash, item_uuid, category_name, item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if a_key not in old_argomenti_set:
                        materia = a.get("materia", "Materia")
                        data_str = a.get("data", "").strip()
                        contenuto = a.get("contenuto", "").strip()
                        docente = a.get("docente", "").strip()

                        if tipo_arg == "assegnazione":
                            title = f"Nuovo Compito: {materia}"
                            message = f"Per il {data_str}: {contenuto}" if data_str else f"Compito: {contenuto}"
                            item_type = "compito"
                            should_send = allow_compiti
                        else:
                            title = f"Nuovo Argomento: {materia}"
                            doc_txt = f" - Prof. {docente}" if docente else ""
                            message = f"({data_str}): {contenuto}{doc_txt}" if data_str else f"{contenuto}{doc_txt}"
                            item_type = "argomento"
                            should_send = allow_argomenti

                        if should_send:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "compiti", "materia": materia},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_{item_type}"
                            )
                            notifications_count += 1

                        mark_notification_sent(user_hash, item_uuid, item_type, item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": item_type,
                            "user_hash": user_hash,
                            "materia": materia,
                            "data": data_str,
                            "sent": should_send
                        })

                # 3. Diffing Agenda
                old_agenda = old_data.get("agenda", [])
                old_agenda_set = {
                    (
                        ag.get("data", ""),
                        ag.get("titolo", ""),
                        ag.get("tipo", ""),
                        ag.get("docente", "")
                    )
                    for ag in old_agenda if isinstance(ag, dict)
                }

                new_agenda = fresh_data.get("agenda", [])
                for ag in new_agenda:
                    if not isinstance(ag, dict):
                        continue
                    ag_key = (
                        ag.get("data", ""),
                        ag.get("titolo", ""),
                        ag.get("tipo", ""),
                        ag.get("docente", "")
                    )
                    item_key = build_item_key(user_hash, "agenda", ag)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se la data è vecchia (> 14 giorni), archivia senza inviare push
                    if is_item_too_old(ag.get("data", "")):
                        mark_notification_sent(user_hash, item_uuid, "agenda", item_key, "Archived old agenda")
                        current_sent_keys.add(item_key)
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if ag_key in old_agenda_set:
                        mark_notification_sent(user_hash, item_uuid, "agenda", item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if ag_key not in old_agenda_set:
                        data_ag = ag.get("data", "").strip()
                        titolo_ag = ag.get("titolo", "Nuovo Evento").strip()
                        orario_ag = ag.get("orario", "").strip()
                        docente_ag = ag.get("docente", "").strip()

                        title = f"Agenda: {titolo_ag}"
                        dettagli = []
                        if data_ag:
                            dettagli.append(f"Data: {data_ag}")
                        if orario_ag:
                            dettagli.append(f"Ore {orario_ag}")
                        if docente_ag:
                            dettagli.append(f"Prof. {docente_ag}")
                        message = " | ".join(dettagli) if dettagli else titolo_ag

                        if allow_agenda:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "agenda", "data": data_ag},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_agenda"
                            )
                            notifications_count += 1

                        mark_notification_sent(user_hash, item_uuid, "agenda", item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": "agenda",
                            "user_hash": user_hash,
                            "titolo": titolo_ag,
                            "data": data_ag,
                            "sent": allow_agenda
                        })

                # 4. Diffing Notizie & Comunicazioni
                old_notizie = old_data.get("notizie", [])
                old_notizie_set = {
                    (
                        n.get("id_tread") or n.get("oggetto", ""),
                        n.get("mittente", ""),
                        n.get("data", "")
                    )
                    for n in old_notizie if isinstance(n, dict)
                }

                new_notizie = fresh_data.get("notizie", [])
                for n in new_notizie:
                    if not isinstance(n, dict):
                        continue
                    n_key = (
                        n.get("id_tread") or n.get("oggetto", ""),
                        n.get("mittente", ""),
                        n.get("data", "")
                    )
                    item_key = build_item_key(user_hash, "notizia", n)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se la data è vecchia (> 14 giorni), archivia senza inviare push
                    if is_item_too_old(n.get("data", "")):
                        mark_notification_sent(user_hash, item_uuid, "notizia", item_key, "Archived old notice")
                        current_sent_keys.add(item_key)
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if n_key in old_notizie_set:
                        mark_notification_sent(user_hash, item_uuid, "notizia", item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if n_key not in old_notizie_set:
                        mittente = n.get("mittente", "Scuola").strip()
                        oggetto = n.get("oggetto", "Nuova Comunicazione").strip()
                        data_notizia = n.get("data", "").strip()

                        title = f"Comunicazione: {mittente}"
                        message = f"{oggetto}" + (f" ({data_notizia})" if data_notizia else "")

                        if allow_notizie:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "notizie", "id_tread": n.get("id_tread", "")},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_notizia"
                            )
                            notifications_count += 1

                        mark_notification_sent(user_hash, item_uuid, "notizia", item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": "notizia",
                            "user_hash": user_hash,
                            "mittente": mittente,
                            "oggetto": oggetto,
                            "sent": allow_notizie
                        })

                # 5. Diffing Assenze & Ritardi
                old_assenze = old_data.get("assenze", [])
                old_assenze_set = {
                    (
                        ass.get("data", ""),
                        ass.get("tipo", ""),
                        ass.get("descrizione", "")
                    )
                    for ass in old_assenze if isinstance(ass, dict)
                }

                new_assenze = fresh_data.get("assenze", [])
                for ass in new_assenze:
                    if not isinstance(ass, dict):
                        continue
                    ass_key = (
                        ass.get("data", ""),
                        ass.get("tipo", ""),
                        ass.get("descrizione", "")
                    )
                    item_key = build_item_key(user_hash, "assenza", ass)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se la data è vecchia (> 14 giorni), archivia senza inviare push
                    if is_item_too_old(ass.get("data", "")):
                        mark_notification_sent(user_hash, item_uuid, "assenza", item_key, "Archived old absence")
                        current_sent_keys.add(item_key)
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if ass_key in old_assenze_set:
                        mark_notification_sent(user_hash, item_uuid, "assenza", item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if ass_key not in old_assenze_set:
                        tipo_ass = ass.get("tipo", "Assenza").strip()
                        data_ass = ass.get("data", "").strip()
                        desc_ass = ass.get("descrizione", "").strip()
                        giustificata = ass.get("giustificata", False)

                        title = f"Registro: {tipo_ass}"
                        giust_txt = " • Giustificata" if giustificata else " • Da giustificare"
                        dett_txt = f" ({desc_ass})" if desc_ass else ""
                        message = f"Registrata {tipo_ass} il {data_ass}{dett_txt}{giust_txt}"

                        if allow_assenze:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "assenze"},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_assenza"
                            )
                            notifications_count += 1

                        mark_notification_sent(user_hash, item_uuid, "assenza", item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": "assenza",
                            "user_hash": user_hash,
                            "tipo": tipo_ass,
                            "data": data_ass,
                            "sent": allow_assenze
                        })

                # 6. Diffing Note Disciplinari
                old_note = old_data.get("note", [])
                old_note_set = {
                    nt.get("contenuto", "").strip()
                    for nt in old_note if isinstance(nt, dict)
                }

                new_note = fresh_data.get("note", [])
                for nt in new_note:
                    if not isinstance(nt, dict):
                        continue
                    testo_nota = nt.get("contenuto", "").strip()
                    item_key = build_item_key(user_hash, "nota", nt)
                    item_uuid = build_item_uuid(item_key)

                    # Se già notificato in passato, NON rimandare mai più
                    if is_notification_already_sent(user_hash, item_key, current_sent_keys):
                        continue

                    # Se era già presente nel vecchio snapshot, è storico: archivialo
                    if testo_nota in old_note_set:
                        mark_notification_sent(user_hash, item_uuid, "nota", item_key, "Already in old snapshot")
                        current_sent_keys.add(item_key)
                        continue

                    if testo_nota and testo_nota not in old_note_set:
                        title = "Nuova Nota Disciplinare"
                        message = testo_nota[:120] + ("..." if len(testo_nota) > 120 else "")

                        if allow_note:
                            send_push_notification(
                                user_hash,
                                title,
                                message,
                                data_payload={"view": "note"},
                                idempotency_key=item_uuid,
                                collapse_id=f"{user_hash}_nota"
                            )
                            notifications_count += 1

                        mark_notification_sent(user_hash, item_uuid, "nota", item_key, title)
                        current_sent_keys.add(item_key)

                        notified_items.append({
                            "type": "nota",
                            "user_hash": user_hash,
                            "testo": testo_nota,
                            "sent": allow_note
                        })

                # Aggiornamento cache e database con il nuovo snapshot e la lista _sent_keys
                fresh_data["_sent_keys"] = list(current_sent_keys)
                save_user_data(user_hash, fresh_data)
                GLOBAL_CACHE[username] = fresh_data

            except Exception as ex:
                app.logger.error(f"[CRON] Eccezione controllo aggiornamenti per {username}: {ex}")
                errors.append(f"Errore per {username}: {str(ex)}")

        return jsonify({
            "success": True,
            "checked": checked_count,
            "notifications_sent": notifications_count,
            "notified_items": notified_items,
            "errors": errors
        })

    except Exception as global_ex:
        app.logger.error(f"[CRON GLOBAL ERROR] {global_ex}")
        return jsonify({"success": False, "error": str(global_ex)}), 500



@app.route("/api/corsi/toggle", methods=["POST"])
def toggle_corso():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
        
    data = request.json
    id_corso = data.get("id_corso")
    action = data.get("action")
    
    api = MastercomAPI(session['user'], session['password'])
    if not api.login():
        return jsonify({"error": "Sessione scaduta"}), 401
        
    success = api.toggle_corso(id_corso, action)
    return jsonify({"success": success})

@app.route("/api/badge", methods=["GET"])
def get_badge_route():
    if 'user' not in session or 'password' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    user = session['user']
    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]

    cached_data, _ = get_cached_user_data(user_hash)
    if cached_data and cached_data.get("badge") and cached_data["badge"].get("codice"):
        return jsonify({
            "success": True,
            "badge": cached_data["badge"]
        })

    api = GLOBAL_API.get(user)
    if not api or not getattr(api, "data_session", None):
        api = MastercomAPI(user, session['password'])
        if not api.login():
            return jsonify({"error": "Sessione scaduta"}), 401
        GLOBAL_API[user] = api

    badge_data = api.get_badge()
    if cached_data:
        cached_data["badge"] = badge_data
        save_user_data(user_hash, cached_data)
        GLOBAL_CACHE[user] = cached_data

    return jsonify({
        "success": True,
        "badge": badge_data
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    user = session.get('user')
    if user:
        GLOBAL_CACHE.pop(user, None)
        GLOBAL_API.pop(user, None)
    session.clear()
    return jsonify({"success": True})

@app.route("/api/insights", methods=["POST"])
def get_insights():
    data = request.json or {}
    api_key = os.environ.get("GEMINI_API_KEY", "")
    
    if not api_key:
        return jsonify({"success": False, "error": "Chiave API Mancante. Configura GEMINI_API_KEY per usare le funzioni AI."})
    
    context_data = data.get("context", {})
    if not context_data and 'user' in session:
        cached, _ = get_user_cached_or_db_data(session['user'])
        if cached:
            voti = cached.get("voti", [])
            argomenti = cached.get("argomenti", [])
            agenda = cached.get("agenda", [])
            voti_validi = [v for v in voti if isinstance(v, dict) and not v.get("peso_zero")]
            insufficienze = [
                {"materia": v.get("materia"), "voto": v.get("voto"), "data": v.get("data")}
                for v in voti_validi if v.get("valore") and float(v.get("valore", 10)) < 6.0
            ]
            compiti = [
                {"materia": a.get("materia"), "data_consegna": a.get("data"), "compito": a.get("contenuto")}
                for a in argomenti if isinstance(a, dict) and re.search(r"asseg|compit", a.get("tipo", ""), re.I) and a.get("stato") != "Fatto"
            ]
            lezioni = [
                {"materia": a.get("materia"), "data_lezione": a.get("data"), "argomento_spiegato": a.get("contenuto"), "docente": a.get("docente")}
                for a in argomenti if isinstance(a, dict) and not re.search(r"asseg|compit", a.get("tipo", ""), re.I)
            ]
            verifiche = [
                {"data": ag.get("data"), "titolo": ag.get("titolo"), "docente": ag.get("docente")}
                for ag in agenda if isinstance(ag, dict) and re.search(r"verif|compito in classe|interrog|recupero|test", ag.get("titolo", ""), re.I)
            ]
            context_data = {
                "nome": cached.get("utente", {}).get("name", "Studente"),
                "oggi": data.get("oggi", ""),
                "totale_voti": len(voti_validi),
                "insufficienze": insufficienze,
                "compiti_da_fare": compiti[:6],
                "argomenti_lezioni_spiegate": lezioni[:6],
                "verifiche_programmate": verifiche[:6]
            }
    
    system_prompt = f"""Sei EduTrack AI, il personal tutor e consulente di strategia didattica d'élite dello studente.
Il tuo compito è produrre un'Analisi Strategica autorevole, precisa, concreta, motivante ed elegante, basata rigorosamente sui dati reali dello studente.

REGOLE CRITICHE E OBBLIGATORIE (NON DEROGARE MAI):
1. DISTINZIONE ASSOLUTA TRA COMPITI vs ARGOMENTI DI LEZIONE:
   - "compiti_da_fare": sono compiti ed esercizi assegnati per casa da svolgere. Solo per questi puoi dire "svolgi i compiti" o "completa l'esercizio".
   - "argomenti_lezioni_spiegate": sono le lezioni o spiegazioni già affrontate in classe dai docenti. NON SONO COMPITI DA FARE! Non dire MAI "fai i compiti di storia" o "prepara i compiti di lettere" se si tratta di lezioni/argomenti spiegati. Per gli argomenti puoi al massimo suggerire un ripasso concettuale o una revisione degli appunti con tag "Ripasso".
   - "verifiche_programmate": interrogazioni o verifiche calendarizzate. Assegna priorità con tag "Verifica".
2. AREE CRITICHE (VERITÀ E ZERO ALLUCINAZIONI):
   - La sezione "aree_critiche" serve ESCLUSIVAMENTE per segnalare insufficienze (voti < 6) reali registrate.
   - SE LO STUDENTE NON HA INSUFFICIENZE (array "insufficienze" vuoto o assente): DEVI TASSATIVAMENTE RESTITUIRE "aree_critiche": [] (array vuoto)!
   - NON inventare MAI problemi, allarmi, scadenze ordinarie o lezioni da spacciare per "aree critiche". L'assenza di insufficienze significa che la situazione è sotto controllo.
3. PRIORITÀ CHIARE E AZIONABILI (MASSIMO 3):
   - Identifica 2 o 3 priorità concrete e ragionate per i prossimi giorni.
   - Dai priorità a verifiche imminenti o compiti da svolgere. Se non ci sono verifiche o compiti urgenti, suggerisci ripasso strategico o organizzazione del metodo.
   - Ogni priorità DEVE avere:
     * "titolo": breve, deciso e azionabile (es. "Verifica Sistemi e Reti", "Esercizi Telecomunicazioni", "Consolidamento Appunti Storia").
     * "dettaglio": spiegazione sintetica (1 frase chiara) su cosa fare concretamente.
     * "tag": uno tra: "Verifica", "Compito", "Ripasso", "Metodo".
4. METODO E STRATEGIA DIDATTICA:
   - Fornisci una strategia didattica con "titolo" (es. Active Recall, Tecnica Feynman, Metodo Cornell, Time Boxing) e "consiglio" pratico (20-35 parole) focalizzato su massimizzare il rendimento riducendo lo stress.
5. STATO GENERALE E LIVELLO:
   - "stato_badge": "In Controllo" | "Ottimo Rendimento" | "Attenzione Richiesta" | "Piano Recupero".
     * Se ci sono insufficienze: "Attenzione Richiesta" (1 insufficienza) o "Piano Recupero" (2+ insufficienze), "stato_livello": "warning" o "danger".
     * Se non ci sono insufficienze e la media è alta (>=7.5): "Ottimo Rendimento", "stato_livello": "success".
     * Se non ci sono insufficienze o pochi voti: "In Controllo", "stato_livello": "success".

DEVI restituire esclusivamente un oggetto JSON valido conforme (senza blocchi markdown o ```json):
{{
  "stato_badge": "In Controllo",
  "stato_livello": "success",
  "motivazione": "Frase motivazionale concreta, calorosa e incisiva (15-25 parole), calibrata sulla reale situazione dello studente.",
  "priorita": [
    {{
      "titolo": "Azione chiara",
      "dettaglio": "Spiegazione breve e contestuale",
      "tag": "Verifica" | "Compito" | "Ripasso" | "Metodo"
    }}
  ],
  "aree_critiche": [
    {{
      "materia": "Materia con insufficienza",
      "motivo": "Spiegazione sintetica del recupero necessario"
    }}
  ],
  "strategia": {{
    "titolo": "Nome Metodo (es. Active Recall)",
    "consiglio": "Consiglio pratico per massimizzare la resa con meno fatica."
  }}
}}

ECCO I DATI REALI DELLO STUDENTE:
{json.dumps(context_data, ensure_ascii=False, indent=2)}
"""

    headers = {"Content-Type": "application/json"}
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": "Genera l'analisi strategica JSON dello studente."}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    
    models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"]
    
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            r = requests.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                resp_txt = r.json()['candidates'][0]['content']['parts'][0]['text']
                try:
                    insights = json.loads(resp_txt)
                    if "aree_critiche" not in insights or insights["aree_critiche"] is None:
                        insights["aree_critiche"] = []
                    if "stato_livello" not in insights:
                        insights["stato_livello"] = "warning" if len(insights["aree_critiche"]) > 0 else "success"
                    if "stato_badge" not in insights:
                        insights["stato_badge"] = "Attenzione Richiesta" if len(insights["aree_critiche"]) > 0 else "In Controllo"
                    # Assicura retrocompatibilità
                    if "focus_materie" not in insights:
                        insights["focus_materie"] = [
                            f"{item.get('materia')}: {item.get('motivo')}" if isinstance(item, dict) else str(item)
                            for item in insights["aree_critiche"]
                        ]
                    if "consiglio_studio" not in insights and "strategia" in insights:
                        insights["consiglio_studio"] = insights["strategia"].get("consiglio", "")
                    return jsonify({"success": True, "insights": insights})
                except:
                    return jsonify({"success": False, "error": "Formato risposta non valido dal server AI."})
            elif r.status_code == 404:
                continue
            else:
                return jsonify({"success": False, "error": f"Errore API ({model_name}): {r.status_code} - {r.text}"})
        except Exception as e:
            return jsonify({"success": False, "error": f"Errore di connessione: {str(e)}"})
            
    return jsonify({"success": False, "error": "Errore API: 404 - Nessun modello Gemini trovato o supportato con questa chiave."})

@app.route("/api/ai/usage", methods=["GET"])
def get_ai_usage():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]
    current_count = 0
    try:
        with get_db() as conn:
            row = conn.execute("""
                SELECT count FROM ai_usage 
                WHERE user_hash = ? AND usage_date = date('now', 'localtime')
            """, (user_hash,)).fetchone()
        current_count = row['count'] if row else 0
    except Exception as e:
        app.logger.warning(f"Errore lettura ai_usage: {e}")
    return jsonify({"success": True, "remaining": max(0, 10 - current_count)})

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    data = request.json or {}
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return jsonify({"success": False, "error": "Chiave API Mancante."})

    user = session['user']
    user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    current_count = 0
    try:
        with get_db() as conn:
            row = conn.execute("""
                SELECT count FROM ai_usage 
                WHERE user_hash = ? AND usage_date = date('now', 'localtime')
            """, (user_hash,)).fetchone()
        current_count = row['count'] if row else 0
    except Exception as e:
        app.logger.warning(f"Errore lettura ai_usage in chat: {e}")
        
    if current_count >= 10:
        return jsonify({"success": False, "error": "Hai raggiunto il limite di 10 messaggi al giorno per EduTrack AI."}), 429
    
    user_message = data.get("message", "")
    context_data = data.get("context", {})
    if not context_data:
        cached, _ = get_user_cached_or_db_data(user)
        if cached:
            context_data = {
                "nome": cached.get("utente", {}).get("name", "Studente"),
                "voti": cached.get("voti", []),
                "agenda": cached.get("agenda", []),
                "argomenti": cached.get("argomenti", []),
                "oggi": data.get("oggi", "")
            }
    
    system_prompt = f"""Sei EduTrack AI, l'assistente scolastico personale dello studente {context_data.get('nome', 'Studente')}.
Rispondi in italiano, in modo amichevole, conciso e utile.
Hai accesso ai dati scolastici dello studente:
- Voti recenti: {context_data.get('voti', 'non disponibili')}
- Agenda: {context_data.get('agenda', 'non disponibile')}
- Argomenti/Compiti: {context_data.get('argomenti', 'non disponibili')}
- Data di oggi: {context_data.get('oggi', '')}
REGOLA FONDAMENTALE: Negli 'Argomenti/Compiti', distingui sempre con rigore tra lezioni spiegate ('argomento', spiegazioni svolte in classe, NON sono compiti da fare) e compiti effettivi ('assegnazione', da fare a casa). Non dire MAI che lo studente ha compiti da fare se si tratta di lezioni/argomenti spiegati. Inoltre non allucinare insufficienze o problemi se tutti i voti sono positivi o se non ci sono ancora voti.
Rispondi in testo semplice, NON in JSON. Usa emoji dove appropriato."""
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_message}]}],
        "generationConfig": {"temperature": 0.7}
    }
    
    models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"]
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            r = requests.post(url, json=payload, headers=headers)
            if r.status_code == 200:
                resp_txt = r.json()['candidates'][0]['content']['parts'][0]['text']
                
                new_count = current_count + 1
                try:
                    with get_db() as conn:
                        conn.execute("""
                            INSERT INTO ai_usage (user_hash, usage_date, count)
                            VALUES (?, date('now', 'localtime'), 1)
                            ON CONFLICT(user_hash, usage_date) DO UPDATE SET count = count + 1
                        """, (user_hash,))
                        conn.commit()
                except Exception as db_err:
                    app.logger.warning(f"Errore registrazione ai_usage su DB (risposta comunque valida): {db_err}")
                
                return jsonify({"success": True, "reply": resp_txt, "remaining": max(0, 10 - new_count)})
            elif r.status_code == 404:
                continue
            else:
                return jsonify({"success": False, "error": f"Errore API: {r.status_code}"})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})
    return jsonify({"success": False, "error": "Nessun modello AI disponibile."})

def compute_student_stats(cached):
    if not cached:
        return None
    user_info = cached.get("utente", {})
    name = user_info.get("name", "Studente")
    foto = user_info.get("foto", "")
    
    voti = cached.get("voti", [])
    assenze = cached.get("assenze", [])
    
    ritardi_count = 0
    assenze_count = 0
    for a in assenze:
        tipo = str(a.get("tipo", "")).upper()
        motivo = str(a.get("motivo", "")).lower()
        if "R" in tipo or "ritardo" in motivo:
            ritardi_count += 1
        else:
            assenze_count += 1

    materie = {}
    all_voti = []
    distribuzione_voti = {"insufficienti": 0, "discreti": 0, "ottimi": 0}

    for v in voti:
        try:
            val = str(v.get("voto", "")).replace(",", ".")
            if not val or v.get("peso_zero"):
                continue
            n = float(re.sub(r'[^0-9.]', '', val)) if any(c.isdigit() for c in val) else None
            if n is not None:
                mat = v.get("materia", "Sconosciuta").strip()
                if mat not in materie:
                    materie[mat] = []
                materie[mat].append(n)
                all_voti.append(n)
                if n < 6.0:
                    distribuzione_voti["insufficienti"] += 1
                elif n < 8.0:
                    distribuzione_voti["discreti"] += 1
                else:
                    distribuzione_voti["ottimi"] += 1
        except Exception:
            continue

    medie_materie = {mat: round(sum(vals)/len(vals), 2) for mat, vals in materie.items() if vals}
    media_globale = round(sum(all_voti)/len(all_voti), 2) if all_voti else 0.0

    miglior_materia = {"materia": "N/D", "media": 0.0}
    peggior_materia = {"materia": "N/D", "media": 10.0}
    if medie_materie:
        best_mat = max(medie_materie.items(), key=lambda x: x[1])
        worst_mat = min(medie_materie.items(), key=lambda x: x[1])
        miglior_materia = {"materia": best_mat[0], "media": best_mat[1]}
        peggior_materia = {"materia": worst_mat[0], "media": worst_mat[1]}
    else:
        peggior_materia["media"] = 0.0

    return {
        "name": name,
        "foto": foto,
        "media_globale": media_globale,
        "medie_materie": medie_materie,
        "voti_count": len(all_voti),
        "assenze_count": assenze_count,
        "ritardi_count": ritardi_count,
        "distribuzione_voti": distribuzione_voti,
        "miglior_materia": miglior_materia,
        "peggior_materia": peggior_materia
    }


@app.route('/api/share/generate', methods=['POST'])
def generate_share_code():
    req_data = request.get_json(silent=True) or {}
    user = session.get('user')
    
    cached = None
    if user:
        cached, _ = get_user_cached_or_db_data(user)
    
    if not cached and 'client_data' in req_data:
        cached = req_data['client_data']
        if not user:
            user = cached.get('utente', {}).get('name', 'user_' + ''.join(random.choices(string.digits, k=6)))

    if not cached:
        return jsonify({"error": "Dati non disponibili, effettua prima la sincronizzazione"}), 400

    u_hash = hash_user(user) if user else "anon"
    stats = compute_student_stats(cached)
    if not stats:
        return jsonify({"error": "Errore nel calcolo delle statistiche"}), 400
    stats["username"] = user

    # Genera codice alfanumerico univoco a 6 caratteri leggibili
    chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    new_code = ''.join(random.choice(chars) for _ in range(6))

    try:
        with get_db() as conn:
            conn.execute("DELETE FROM share_codes WHERE user_hash = ?", (u_hash,))
            conn.execute(
                "INSERT INTO share_codes (code, user_hash, data_json, created_at) VALUES (?, ?, ?, ?)",
                (new_code, u_hash, json.dumps(stats, ensure_ascii=False), time.time())
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Errore salvataggio share_code: {e}")

    SHARE_DB[new_code] = stats
    return jsonify({"success": True, "code": new_code, "data": stats})


@app.route('/api/share/compare/<code>', methods=['GET', 'POST'])
def compare_share_code(code):
    req_data = request.get_json(silent=True) or {}
    user = session.get('user')
    code = code.strip().upper()

    friend_stats = None
    if code in SHARE_DB:
        friend_stats = SHARE_DB[code]
    else:
        try:
            with get_db() as conn:
                row = conn.execute("SELECT data_json FROM share_codes WHERE code = ?", (code,)).fetchone()
                if row:
                    friend_stats = json.loads(row[0])
                    SHARE_DB[code] = friend_stats
        except Exception as e:
            logger.error(f"Errore lettura share_code: {e}")

    if not friend_stats:
        return jsonify({"success": False, "error": "Codice non trovato o scaduto."})

    cached = None
    if user:
        cached, _ = get_user_cached_or_db_data(user)
    
    if not cached and 'client_data' in req_data:
        cached = req_data['client_data']
        if not user:
            user = cached.get('utente', {}).get('name', 'Tu')

    if not cached:
        return jsonify({"success": False, "error": "Dati personali non disponibili. Effettua una sincronizzazione."})

    my_stats = compute_student_stats(cached)
    if not my_stats:
        return jsonify({"success": False, "error": "Errore nel calcolo dei dati personali."})

    is_self = (friend_stats.get("username") == user)

    # Costruzione array materie unificate con calcolo Delta
    my_m = my_stats.get("medie_materie", {})
    fr_m = friend_stats.get("medie_materie", {})
    all_subjects = sorted(list(set(list(my_m.keys()) + list(fr_m.keys()))))

    materie_confronto = []
    max_pos_delta = -999.0
    materia_dominante = None

    for sub in all_subjects:
        val_io = my_m.get(sub)
        val_amico = fr_m.get(sub)
        delta = None
        vincitore = "pari"

        if val_io is not None and val_amico is not None:
            delta = round(val_io - val_amico, 2)
            if delta > 0:
                vincitore = "io"
                if delta > max_pos_delta:
                    max_pos_delta = delta
                    materia_dominante = {
                        "materia": sub,
                        "delta": delta,
                        "mia_media": val_io,
                        "amico_media": val_amico
                    }
            elif delta < 0:
                vincitore = "amico"
            else:
                vincitore = "pari"

        materie_confronto.append({
            "materia": sub,
            "mia_media": val_io,
            "amico_media": val_amico,
            "delta": delta,
            "vincitore": vincitore
        })

    # Calcolo Verdetto
    delta_globale = round(my_stats["media_globale"] - friend_stats["media_globale"], 2)
    if delta_globale > 0:
        verdetto = {
            "tipo": "vantaggio",
            "delta": delta_globale,
            "testo": f"In Vantaggio di +{delta_globale:.2f}",
            "descrizione": f"La tua media ({my_stats['media_globale']:.2f}) supera quella di {friend_stats['name']} ({friend_stats['media_globale']:.2f})!"
        }
    elif delta_globale < 0:
        verdetto = {
            "tipo": "svantaggio",
            "delta": delta_globale,
            "testo": f"In Svantaggio di {delta_globale:.2f}",
            "descrizione": f"{friend_stats['name']} ha una media superiore ({friend_stats['media_globale']:.2f} vs {my_stats['media_globale']:.2f}). Sfida aperta per il recupero!"
        }
    else:
        verdetto = {
            "tipo": "pareggio",
            "delta": 0.0,
            "testo": "Pareggio Perfetto",
            "descrizione": f"Media identica ({my_stats['media_globale']:.2f})! Siete perfettamente allineati."
        }

    return jsonify({
        "success": True,
        "is_self": is_self,
        "me": my_stats,
        "friend": friend_stats,
        "materie_confronto": materie_confronto,
        "materia_dominante": materia_dominante,
        "verdetto": verdetto
    })

@app.route('/api/notizia/<notizia_id>')
def api_notizia(notizia_id):
    if 'user' not in session: return jsonify({"error":"Non autorizzato"}),401
    
    # Crea api on the fly ma non farci un full fetch, login() serve solo ad avere la session o si appoggia alla cache
    api = MastercomAPI(session['user'], session['password'])
    if not api.login(): return jsonify({"error":"Sessione scolastica scaduta"}),401
    
    id_tread = request.args.get('id_tread', '')
    dati = api.leggi_notizia(notizia_id, id_tread=id_tread)
    return jsonify(dati)

@app.route('/api/notizia/download')
def api_notizia_download():
    from flask import Response, request
    
    if 'user' not in session or 'password' not in session:
        return "Non autorizzato", 401
    
    notizia_id = request.args.get('notizia_id')
    id_tread = request.args.get('id_tread', '')
    idx = request.args.get('idx', type=int)
    id_file = request.args.get('id_file')
    app_name = request.args.get('app', 'messenger')
    direct_url = request.args.get('url')
    target_filename = request.args.get('nome', 'allegato')

    api = MastercomAPI(session['user'], session['password'])
    if not api.login():
        return "Sessione scolastica scaduta", 401

    # Se abbiamo notizia_id e idx ma non id_file / direct_url, proviamo a risolverli
    if (not id_file and not direct_url) and notizia_id is not None:
        try:
            dati = api.leggi_notizia(notizia_id, id_tread=id_tread)
            allegati = dati.get('allegati', [])
            if idx is not None and 0 <= idx < len(allegati):
                att = allegati[idx]
                id_file = att.get('id_file')
                direct_url = att.get('raw_url') or att.get('next_api_url')
                if att.get('nome'):
                    target_filename = att['nome']
            elif allegati:
                att = allegati[0]
                id_file = att.get('id_file')
                direct_url = att.get('raw_url') or att.get('next_api_url')
                if att.get('nome'):
                    target_filename = att['nome']
        except Exception as e:
            app.logger.error(f"Errore recupero metadati notizia {notizia_id}: {e}")

    # Helper per creare la Response Flask con streaming e corretti Content-Disposition
    def _make_stream_response(resp, default_name):
        content_type = resp.headers.get('Content-Type', 'application/pdf')
        
        cd_header = resp.headers.get('Content-Disposition', '')
        filename = None
        if cd_header:
            m_fn = re.search(r'filename\*=UTF-8\'\'([^;]+)', cd_header, re.I)
            if m_fn:
                filename = urllib.parse.unquote(m_fn.group(1))
            else:
                m_fn2 = re.search(r'filename=["\']?([^"\';]+)["\']?', cd_header, re.I)
                if m_fn2:
                    filename = m_fn2.group(1)

        if not filename or filename == 'allegato':
            filename = default_name

        filename = urllib.parse.unquote(filename)
        filename = filename.replace('"', '').replace('\n', '').replace('\r', '').strip()
        if not filename.lower().endswith(('.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.zip', '.txt')):
            if 'pdf' in content_type.lower():
                filename += '.pdf'

        encoded_fn = urllib.parse.quote(filename)
        headers = {
            'Content-Type': content_type,
            'Content-Disposition': f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_fn}'
        }
        if 'Content-Length' in resp.headers:
            headers['Content-Length'] = resp.headers['Content-Length']

        return Response(resp.iter_content(chunk_size=8192), content_type=content_type, headers=headers)

    # 1° Tentativo Prioritario: next-api (Endpoint moderno Mastercom: agnelli-to.registroelettronico.com/next-api/v1/download/{id}?direct=true)
    if id_file:
        next_url = f"https://agnelli-to.registroelettronico.com/next-api/v1/download/{id_file}?direct=true"
        try:
            res = api.session.get(next_url, stream=True, allow_redirects=True, timeout=30)
            if res.ok and not res.headers.get('Content-Type', '').startswith('text/html'):
                return _make_stream_response(res, target_filename)
        except Exception as e:
            app.logger.warning(f"Errore download next-api per {id_file}: {e}")

    # 2° Tentativo: direct_url (S3 o URL remoto)
    if direct_url and (direct_url.startswith('http://') or direct_url.startswith('https://')):
        try:
            clean_direct_url = direct_url.replace('&amp;', '&')
            if 's3.' in clean_direct_url or 'io.cloud.ovh.net' in clean_direct_url:
                clean_direct_url = re.sub(r'[&?]visualizza_app=[^&]*', '', clean_direct_url)

            res = requests.get(clean_direct_url, stream=True, timeout=30)
            if not res.ok:
                res = api.session.get(clean_direct_url, stream=True, allow_redirects=True, timeout=30)
            if res.ok and not res.headers.get('Content-Type', '').startswith('text/html'):
                return _make_stream_response(res, target_filename)
        except Exception as e:
            app.logger.warning(f"Errore download direct_url: {e}")

    # 3° Tentativo: funzioni_comuni/download_documento.php
    if id_file:
        url_old = f"https://agnelli-to.registroelettronico.com/mastercom/funzioni_comuni/download_documento.php?id_documento={id_file}&applicazione={app_name}"
        try:
            res = api.session.get(url_old, stream=True, allow_redirects=True, timeout=30)
            if res.ok and not res.headers.get('Content-Type', '').startswith('text/html'):
                return _make_stream_response(res, target_filename)
        except Exception as e:
            app.logger.warning(f"Errore download funzioni_comuni per {id_file}: {e}")

    # 4° Tentativo: POST messenger scarica_allegato
    if id_file:
        try:
            payload = {
                'stato_principale': 'messenger',
                'operazione': 'scarica_allegato',
                'id_allegato': id_file
            }
            url_post = "https://agnelli-to.registroelettronico.com/mastercom/index.php"
            res = api.session.post(url_post, data=payload, stream=True, allow_redirects=True, timeout=30)
            if res.ok and not res.headers.get('Content-Type', '').startswith('text/html'):
                return _make_stream_response(res, target_filename)
        except Exception as e:
            app.logger.warning(f"Errore download POST messenger per {id_file}: {e}")

    return "Allegato non trovato o non disponibile.", 404


@app.route('/api/leaderboard/submit', methods=['POST'])
def leaderboard_submit():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    body = request.json or {}
    media = body.get('media')
    display_name = body.get('display_name', 'Studente')

    if media is None:
        return jsonify({"error": "Media mancante"}), 400

    try:
        media = round(float(media), 2)
    except (ValueError, TypeError):
        return jsonify({"error": "Media non valida"}), 400

    # Hash anonimizzato del codice studente come chiave univoca
    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]

    with get_db() as conn:
        conn.execute("""
            INSERT INTO leaderboard (user_hash, display_name, media)
            VALUES (?, ?, ?)
            ON CONFLICT(user_hash) DO UPDATE SET
                display_name = excluded.display_name,
                media = excluded.media,
                submitted_at = datetime('now','localtime')
        """, (user_hash, display_name, media))
        conn.commit()

    return jsonify({"success": True})


@app.route('/api/leaderboard', methods=['GET'])
def leaderboard_get():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]

    with get_db() as conn:
        rows = conn.execute("""
            SELECT display_name, media,
                   RANK() OVER (ORDER BY media DESC) AS rank
            FROM leaderboard
            ORDER BY media DESC
        """).fetchall()

        my_row = conn.execute("""
            SELECT media,
                   RANK() OVER (ORDER BY media DESC) AS rank
            FROM leaderboard
            WHERE user_hash = ?
        """, (user_hash,)).fetchone()

    entries = [
        {"rank": r["rank"], "name": r["display_name"], "media": r["media"]}
        for r in rows
    ]
    my_pos = {"rank": my_row["rank"], "media": my_row["media"]} if my_row else None

    return jsonify({
        "success": True,
        "entries": entries,
        "my_position": my_pos,
        "total": len(entries)
    })


@app.route('/api/leaderboard/opt-out', methods=['DELETE'])
def leaderboard_opt_out():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]
    with get_db() as conn:
        conn.execute("DELETE FROM leaderboard WHERE user_hash = ?", (user_hash,))
        conn.commit()

    return jsonify({"success": True})


@app.route('/api/leaderboard/consent', methods=['GET'])
def leaderboard_consent_get():
    """Restituisce la scelta di consenso salvata per questo utente."""
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]
    with get_db() as conn:
        row = conn.execute(
            "SELECT lb_consent FROM user_prefs WHERE user_hash = ?",
            (user_hash,)
        ).fetchone()
    consent = row['lb_consent'] if row else None
    return jsonify({"success": True, "consent": consent})


@app.route('/api/leaderboard/consent', methods=['POST'])
def leaderboard_consent_post():
    """Salva la scelta di consenso (yes/no) per questo utente."""
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401
    body = request.json or {}
    consent = body.get('consent')
    if consent not in ('yes', 'no'):
        return jsonify({"error": "Valore non valido"}), 400
    user_hash = hashlib.sha256(session['user'].encode()).hexdigest()[:20]
    with get_db() as conn:
        conn.execute("""
            INSERT INTO user_prefs (user_hash, lb_consent)
            VALUES (?, ?)
            ON CONFLICT(user_hash) DO UPDATE SET
                lb_consent = excluded.lb_consent,
                updated_at = datetime('now','localtime')
        """, (user_hash, consent))
        conn.commit()
    return jsonify({"success": True})


@app.route('/api/feedback', methods=['POST'])
def send_feedback():
    if 'user' not in session:
        return jsonify({"error": "Non autorizzato"}), 401

    body = request.json or {}
    tipo     = body.get('tipo', 'Feedback')
    testo    = body.get('messaggio', '').strip()
    studente = body.get('studente', session.get('user', 'Sconosciuto'))

    if not testo:
        return jsonify({"success": False, "error": "Messaggio vuoto"}), 400

    DEST_MAIL = "lorenzo.ruscica2008@gmail.com"
    FROM_MAIL = "lorenzo.ruscica2008@gmail.com"
    APP_PASS  = os.environ.get("GMAIL_APP_PASSWORD", "")

    if not APP_PASS:
        # Salva il feedback in un file locale come fallback
        try:
            fb_path = os.path.join(os.path.dirname(__file__), 'feedback_log.txt')
            with open(fb_path, 'a', encoding='utf-8') as f:
                import datetime
                f.write(f"[{datetime.datetime.now()}] [{tipo}] {studente}: {testo}\n")
            return jsonify({"success": True, "note": "salvato_localmente"})
        except Exception as e:
            return jsonify({"success": False, "error": f"GMAIL_APP_PASSWORD non configurata e salvataggio fallito: {e}"}), 500

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"[EduTrack Feedback] {tipo} da {studente}"
        msg['From']    = FROM_MAIL
        msg['To']      = DEST_MAIL

        html_body = f"""\
<html><body style="font-family:sans-serif;background:#f0f4ff;padding:24px;">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <h2 style="color:#2563eb;margin-top:0">📩 Nuovo Feedback — EduTrack</h2>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
      <tr><td style="padding:8px 0;font-weight:700;color:#6b7280;width:110px;">Tipo</td>
          <td style="padding:8px 0;font-weight:800;color:#111;">{tipo}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;color:#6b7280;">Studente</td>
          <td style="padding:8px 0;color:#111;">{studente}</td></tr>
    </table>
    <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:0.9rem;color:#6b7280;margin-bottom:6px;">Messaggio:</p>
    <div style="background:#f8fafc;border-radius:8px;padding:14px;font-size:1rem;color:#1e293b;white-space:pre-wrap;line-height:1.6;">{testo}</div>
    <p style="margin-top:20px;font-size:0.78rem;color:#9ca3af;text-align:center;">Inviato da EduTrack Registro Elettronico</p>
  </div>
</body></html>"""

        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(FROM_MAIL, APP_PASS)
            server.sendmail(FROM_MAIL, DEST_MAIL, msg.as_string())

        return jsonify({"success": True})

    except smtplib.SMTPAuthenticationError:
        return jsonify({"success": False, "error": "Autenticazione Gmail fallita. Verifica GMAIL_APP_PASSWORD."}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── Integrazione e Sincronizzazione Google Calendar / iCalendar ──────────
MESI_IT_MAP = {
    "gennaio": 1, "gen": 1,
    "febbraio": 2, "feb": 2,
    "marzo": 3, "mar": 3,
    "aprile": 4, "apr": 4,
    "maggio": 5, "mag": 5,
    "giugno": 6, "giu": 6,
    "luglio": 7, "lug": 7,
    "agosto": 8, "ago": 8,
    "settembre": 9, "set": 9, "sett": 9,
    "ottobre": 10, "ott": 10,
    "novembre": 11, "nov": 11,
    "dicembre": 12, "dic": 12
}

def parse_date_it(date_str: str) -> date | None:
    if not date_str or not isinstance(date_str, str):
        return None
    cleaned = date_str.lower().strip()
    
    # 1. ISO format: YYYY-MM-DD
    iso_match = re.search(r'\b(20\d\d)[-/](\d{1,2})[-/](\d{1,2})\b', cleaned)
    if iso_match:
        try:
            return date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))
        except ValueError:
            pass

    # 2. DD/MM/YYYY or DD-MM-YYYY
    num_match = re.search(r'\b(\d{1,2})[-/](\d{1,2})[-/](20\d\d)\b', cleaned)
    if num_match:
        try:
            return date(int(num_match.group(3)), int(num_match.group(2)), int(num_match.group(1)))
        except ValueError:
            pass

    # 3. Testuale: es. "27 marzo", "27 mar Venerdì", "15 settembre 2024"
    text_match = re.search(r'(\d{1,2})\s+([a-zàèéìòù]+)(?:\s+(\d{4}))?', cleaned)
    if text_match:
        day = int(text_match.group(1))
        month_name = text_match.group(2)
        year_cand = text_match.group(3)

        month = None
        for k, v in MESI_IT_MAP.items():
            if month_name == k or month_name.startswith(k):
                month = v
                break
        
        if month:
            today = date.today()
            if year_cand:
                y = int(year_cand)
            else:
                if today.month < 9:
                    y = today.year - 1 if month >= 9 else today.year
                else:
                    y = today.year if month >= 9 else today.year + 1
            try:
                return date(y, month, day)
            except ValueError:
                pass
    return None

def parse_time_range(time_str: str):
    if not time_str or not isinstance(time_str, str):
        return None, None
    s = time_str.strip()
    times = re.findall(r'\b(\d{1,2})[:\.](\d{2})\b', s)
    if len(times) >= 2:
        try:
            h1, m1 = int(times[0][0]), int(times[0][1])
            h2, m2 = int(times[1][0]), int(times[1][1])
            if h2 < h1 or (h2 == h1 and m2 <= m1):
                h2 = (h1 + 1) % 24
                m2 = m1
            return dtime(h1, m1), dtime(h2, m2)
        except Exception:
            pass
    elif len(times) == 1:
        try:
            h1, m1 = int(times[0][0]), int(times[0][1])
            h2 = (h1 + 1) % 24
            return dtime(h1, m1), dtime(h2, m1)
        except Exception:
            pass
    return None, None

def escape_ics(text: str) -> str:
    if not text:
        return ""
    t = str(text).replace('\\', '\\\\').replace(';', r'\;').replace(',', r'\,')
    t = t.replace('\r\n', r'\n').replace('\r', r'\n').replace('\n', r'\n')
    return t

def get_external_base_url():
    proto = request.headers.get("X-Forwarded-Proto", "https" if request.is_secure else "http")
    host = request.headers.get("X-Forwarded-Host", request.host)
    return f"{proto}://{host}"

def get_or_create_calendar_token(user_hash: str) -> str:
    if not user_hash:
        return ""
    try:
        with get_db() as conn:
            row = conn.execute("SELECT feed_token FROM calendar_tokens WHERE user_hash = ?", (user_hash,)).fetchone()
            if row and row["feed_token"]:
                return row["feed_token"]
            
            new_token = hashlib.sha256(f"{user_hash}_{time.time()}_{random.random()}".encode('utf-8')).hexdigest()[:32]
            conn.execute("""
                INSERT INTO calendar_tokens (user_hash, feed_token)
                VALUES (?, ?)
                ON CONFLICT(user_hash) DO UPDATE SET feed_token = excluded.feed_token
            """, (user_hash, new_token))
            conn.commit()
            return new_token
    except Exception as e:
        app.logger.error(f"Errore get_or_create_calendar_token per {user_hash}: {e}")
        return ""

def reset_calendar_token(user_hash: str) -> str:
    if not user_hash:
        return ""
    try:
        new_token = hashlib.sha256(f"{user_hash}_{time.time()}_{random.random()}".encode('utf-8')).hexdigest()[:32]
        with get_db() as conn:
            conn.execute("""
                INSERT INTO calendar_tokens (user_hash, feed_token)
                VALUES (?, ?)
                ON CONFLICT(user_hash) DO UPDATE SET feed_token = excluded.feed_token
            """, (user_hash, new_token))
            conn.commit()
            return new_token
    except Exception as e:
        app.logger.error(f"Errore reset_calendar_token per {user_hash}: {e}")
        return ""

def get_user_hash_by_calendar_token(token: str) -> str:
    if not token or len(token) < 16:
        return ""
    try:
        with get_db() as conn:
            row = conn.execute("SELECT user_hash FROM calendar_tokens WHERE feed_token = ?", (token,)).fetchone()
            if row:
                return row["user_hash"]
    except Exception as e:
        app.logger.error(f"Errore get_user_hash_by_calendar_token: {e}")
    return ""

def build_edutrack_ics(data: dict, include_compiti=True, include_argomenti=True, include_agenda=True) -> str:
    if not isinstance(data, dict):
        data = {}
    if isinstance(data.get("data"), dict) and ("agenda" in data["data"] or "argomenti" in data["data"]):
        data = data["data"]

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EduTrack//Registro Elettronico//IT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:EduTrack Registro",
        "X-WR-TIMEZONE:Europe/Rome",
        "X-WR-CALDESC:Sincronizzazione Compiti, Argomenti e Agenda EduTrack",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Rome",
        "X-LIC-LOCATION:Europe/Rome",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE"
    ]
    
    now_stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    
    # 1. AGENDA
    if include_agenda:
        agenda_items = data.get("agenda", [])
        if isinstance(agenda_items, list):
            for i, item in enumerate(agenda_items):
                if not isinstance(item, dict):
                    continue
                d_val = parse_date_it(item.get("data", ""))
                if not d_val:
                    continue
                
                tipo = (item.get("tipo") or "Agenda").strip().capitalize()
                titolo = (item.get("titolo") or item.get("nota") or "Impegno").strip()
                docente = (item.get("docente") or "").strip()
                orario_str = (item.get("orario") or "").strip()
                nota_str = (item.get("nota") or "").strip()
                
                time_source = f"{orario_str} {docente} {titolo} {nota_str}"
                t_start, t_end = parse_time_range(time_source)
                
                clean_nota = " ".join(nota_str.split()).strip()
                if clean_nota and clean_nota != titolo and clean_nota.lower() != "nessun dettaglio":
                    if len(clean_nota) > 80:
                        clean_nota = clean_nota[:77].strip() + "…"
                    summary = f"[{tipo}] {titolo} - {clean_nota}"
                else:
                    summary = f"[{tipo}] {titolo}"
                desc_parts = []
                if orario_str:
                    desc_parts.append(f"Orario: {orario_str}")
                if docente:
                    desc_parts.append(f"Docente: {docente}")
                if item.get("nota") and item.get("nota") != titolo:
                    desc_parts.append(f"Note: {item.get('nota')}")
                desc_parts.append("EduTrack Registro Elettronico")
                description = "\\n".join(desc_parts)
                
                uid_seed = f"agenda_{d_val}_{orario_str}_{titolo}_{docente}_{i}"
                uid = hashlib.md5(uid_seed.encode('utf-8')).hexdigest() + "@edutrack.app"
                
                lines.append("BEGIN:VEVENT")
                lines.append(f"UID:{uid}")
                lines.append(f"DTSTAMP:{now_stamp}")
                
                if t_start and t_end:
                    dt_s = datetime.combine(d_val, t_start).strftime("%Y%m%dT%H%M%S")
                    dt_e = datetime.combine(d_val, t_end).strftime("%Y%m%dT%H%M%S")
                    lines.append(f"DTSTART;TZID=Europe/Rome:{dt_s}")
                    lines.append(f"DTEND;TZID=Europe/Rome:{dt_e}")
                else:
                    dt_s = d_val.strftime("%Y%m%d")
                    dt_e = (d_val + timedelta(days=1)).strftime("%Y%m%d")
                    lines.append(f"DTSTART;VALUE=DATE:{dt_s}")
                    lines.append(f"DTEND;VALUE=DATE:{dt_e}")
                
                lines.append(f"SUMMARY:{escape_ics(summary)}")
                lines.append(f"DESCRIPTION:{escape_ics(description)}")
                lines.append("CATEGORIES:Scuola,Agenda,EduTrack")
                lines.append("STATUS:CONFIRMED")
                lines.append("TRANSP:OPAQUE")
                lines.append("END:VEVENT")

    # 2. ARGOMENTI & COMPITI
    argomenti_items = data.get("argomenti", [])
    if isinstance(argomenti_items, list):
        for i, item in enumerate(argomenti_items):
            if not isinstance(item, dict):
                continue
            tipo_raw = (item.get("tipo") or "").lower()
            is_compito = ("compito" in tipo_raw or "assegna" in tipo_raw or item.get("stato") in ("Da fare", "Fatto"))
            
            if is_compito and not include_compiti:
                continue
            if not is_compito and not include_argomenti:
                continue
            
            d_val = parse_date_it(item.get("data", ""))
            if not d_val:
                continue
            
            materia = (item.get("materia") or "Generale").strip()
            docente = (item.get("docente") or "").strip()
            contenuto = (item.get("contenuto") or item.get("argomento") or "Nessun dettaglio").strip()
            stato = (item.get("stato") or "").strip()
            
            clean_cont = " ".join(contenuto.split()).strip()
            if clean_cont and clean_cont.lower() != "nessun dettaglio":
                if len(clean_cont) > 80:
                    clean_cont = clean_cont[:77].strip() + "…"
                det_suffix = f" - {clean_cont}"
            else:
                det_suffix = ""
            
            if is_compito:
                summary = f"Compito: {materia}{det_suffix}"
                cat = "Compiti"
            else:
                summary = f"Lezione: {materia}{det_suffix}"
                cat = "Argomenti"
            
            desc_parts = [
                f"Materia: {materia}",
                f"Tipo: {'Compito / Assegnazione' if is_compito else 'Argomento lezione'}"
            ]
            if docente:
                desc_parts.append(f"Docente: {docente}")
            if stato:
                desc_parts.append(f"Stato: {stato}")
            desc_parts.append(f"Dettagli: {contenuto}")
            desc_parts.append("EduTrack Registro Elettronico")
            description = "\\n".join(desc_parts)
            
            uid_seed = f"arg_{d_val}_{materia}_{tipo_raw}_{contenuto[:30]}_{i}"
            uid = hashlib.md5(uid_seed.encode('utf-8')).hexdigest() + "@edutrack.app"
            
            lines.append("BEGIN:VEVENT")
            lines.append(f"UID:{uid}")
            lines.append(f"DTSTAMP:{now_stamp}")
            
            time_source = f"{item.get('orario') or ''} {docente} {contenuto}"
            t_start, t_end = parse_time_range(time_source)
            if t_start and t_end:
                dt_s = datetime.combine(d_val, t_start).strftime("%Y%m%dT%H%M%S")
                dt_e = datetime.combine(d_val, t_end).strftime("%Y%m%dT%H%M%S")
                lines.append(f"DTSTART;TZID=Europe/Rome:{dt_s}")
                lines.append(f"DTEND;TZID=Europe/Rome:{dt_e}")
            else:
                dt_s = d_val.strftime("%Y%m%d")
                dt_e = (d_val + timedelta(days=1)).strftime("%Y%m%d")
                lines.append(f"DTSTART;VALUE=DATE:{dt_s}")
                lines.append(f"DTEND;VALUE=DATE:{dt_e}")
            
            lines.append(f"SUMMARY:{escape_ics(summary)}")
            lines.append(f"DESCRIPTION:{escape_ics(description)}")
            lines.append(f"CATEGORIES:Scuola,{cat},EduTrack")
            lines.append("STATUS:CONFIRMED")
            lines.append("TRANSP:TRANSPARENT" if not is_compito else "TRANSP:OPAQUE")
            lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"

@app.route("/api/calendar/info", methods=["GET"])
def api_calendar_info():
    user = session.get('user')
    user_hash = None
    if user:
        user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    else:
        cand_hash = request.args.get('user_hash') or request.headers.get('X-User-Hash')
        if cand_hash and len(cand_hash) == 20:
            user_hash = cand_hash
            
    if not user_hash:
        return jsonify({"success": False, "error": "Non autenticato. Effettua prima l'accesso."}), 401

    token = get_or_create_calendar_token(user_hash)
    if not token:
        return jsonify({"success": False, "error": "Impossibile generare il token del calendario."}), 500

    base_url = get_external_base_url()
    feed_url = f"{base_url}/api/calendar/feed/{token}.ics"
    webcal_url = re.sub(r'^https?://', 'webcal://', feed_url)
    gcal_subscribe_url = f"https://calendar.google.com/calendar/render?cid={urllib.parse.quote(feed_url, safe='')}"

    return jsonify({
        "success": True,
        "token": token,
        "feed_url": feed_url,
        "webcal_url": webcal_url,
        "gcal_subscribe_url": gcal_subscribe_url
    })

@app.route("/api/calendar/token/reset", methods=["POST"])
def api_calendar_token_reset():
    user = session.get('user')
    user_hash = None
    if user:
        user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]
    else:
        req_data = request.json or {}
        cand_hash = req_data.get('user_hash') or request.headers.get('X-User-Hash')
        if cand_hash and len(cand_hash) == 20:
            user_hash = cand_hash

    if not user_hash:
        return jsonify({"success": False, "error": "Non autenticato."}), 401

    token = reset_calendar_token(user_hash)
    if not token:
        return jsonify({"success": False, "error": "Errore durante il reset del token."}), 500

    base_url = get_external_base_url()
    feed_url = f"{base_url}/api/calendar/feed/{token}.ics"
    webcal_url = re.sub(r'^https?://', 'webcal://', feed_url)
    gcal_subscribe_url = f"https://calendar.google.com/calendar/render?cid={urllib.parse.quote(feed_url, safe='')}"

    return jsonify({
        "success": True,
        "token": token,
        "feed_url": feed_url,
        "webcal_url": webcal_url,
        "gcal_subscribe_url": gcal_subscribe_url
    })

@app.route("/api/calendar/feed/<token>.ics", methods=["GET"])
def api_calendar_feed(token):
    user_hash = get_user_hash_by_calendar_token(token)
    if not user_hash:
        return "Calendario non trovato o token non valido.", 404

    cached_data, _ = get_cached_user_data(user_hash)
    if not cached_data:
        cached_data = {"agenda": [], "argomenti": []}

    inc_compiti = request.args.get("compiti", "1") in ("1", "true", "True")
    inc_argomenti = request.args.get("argomenti", "1") in ("1", "true", "True")
    inc_agenda = request.args.get("agenda", "1") in ("1", "true", "True")

    ics_content = build_edutrack_ics(
        cached_data,
        include_compiti=inc_compiti,
        include_argomenti=inc_argomenti,
        include_agenda=inc_agenda
    )

    resp = make_response(ics_content)
    resp.headers["Content-Type"] = "text/calendar; charset=utf-8"
    resp.headers["Content-Disposition"] = 'inline; filename="edutrack_calendar.ics"'
    resp.headers["Cache-Control"] = "max-age=1800, s-maxage=1800"
    return resp

@app.route("/api/calendar/export.ics", methods=["GET"])
def api_calendar_export():
    token = request.args.get("token")
    user_hash = None
    if token:
        user_hash = get_user_hash_by_calendar_token(token)
    
    if not user_hash:
        user = session.get('user')
        if user:
            user_hash = hashlib.sha256(user.encode()).hexdigest()[:20]

    if not user_hash:
        return "Non autorizzato. Token mancante o sessione scaduta.", 401

    cached_data, _ = get_cached_user_data(user_hash)
    if not cached_data:
        cached_data = {"agenda": [], "argomenti": []}

    inc_compiti = request.args.get("compiti", "1") in ("1", "true", "True")
    inc_argomenti = request.args.get("argomenti", "1") in ("1", "true", "True")
    inc_agenda = request.args.get("agenda", "1") in ("1", "true", "True")

    ics_content = build_edutrack_ics(
        cached_data,
        include_compiti=inc_compiti,
        include_argomenti=inc_argomenti,
        include_agenda=inc_agenda
    )

    resp = make_response(ics_content)
    resp.headers["Content-Type"] = "text/calendar; charset=utf-8"
    resp.headers["Content-Disposition"] = 'attachment; filename="edutrack_calendar.ics"'
    return resp

@app.route("/api/calendar/single.ics", methods=["GET"])
def api_calendar_single_ics():
    title = (request.args.get("title") or "Evento").strip()
    date_str = (request.args.get("date") or "").strip()
    time_str = (request.args.get("time") or "").strip()
    details = (request.args.get("details") or "").strip()

    d_val = parse_date_it(date_str) if date_str else date.today()
    if not d_val:
        d_val = date.today()

    t_start, t_end = parse_time_range(time_str)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//EduTrack//Registro Elettronico//IT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Rome",
        "X-LIC-LOCATION:Europe/Rome",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        f"UID:single_{int(time.time())}_{random.randint(1000, 9999)}@edutrack.app",
        f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}"
    ]

    if t_start and t_end:
        dt_s = datetime.combine(d_val, t_start).strftime("%Y%m%dT%H%M%S")
        dt_e = datetime.combine(d_val, t_end).strftime("%Y%m%dT%H%M%S")
        lines.append(f"DTSTART;TZID=Europe/Rome:{dt_s}")
        lines.append(f"DTEND;TZID=Europe/Rome:{dt_e}")
    else:
        dt_s = d_val.strftime("%Y%m%d")
        dt_e = (d_val + timedelta(days=1)).strftime("%Y%m%d")
        lines.append(f"DTSTART;VALUE=DATE:{dt_s}")
        lines.append(f"DTEND;VALUE=DATE:{dt_e}")

    lines.append(f"SUMMARY:{escape_ics(title)}")
    lines.append(f"DESCRIPTION:{escape_ics(details)}")
    lines.append("STATUS:CONFIRMED")
    lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")

    resp = make_response("\r\n".join(lines) + "\r\n")
    resp.headers["Content-Type"] = "text/calendar; charset=utf-8"
    resp.headers["Content-Disposition"] = 'attachment; filename="evento.ics"'
    return resp


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)

