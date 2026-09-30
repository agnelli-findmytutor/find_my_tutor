import requests
import time
import re
from bs4 import BeautifulSoup
import json
import urllib.parse

class MastercomAPI:
    def __init__(self, user, password):
        self.url = "https://agnelli-to.registroelettronico.com/mastercom/index.php"
        self.user = user
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        })
        self.data_session = {}
        self.ajax_headers = {
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://agnelli-to.registroelettronico.com",
            "Referer": "https://agnelli-to.registroelettronico.com/mastercom/index.php"
        }

    ### LOGIN ###

    def login(self):
        self.session.cookies.clear()
        self.data_session = {}

        self.session.get(self.url)

        now_dt = time.localtime()
        y1 = now_dt.tm_year if now_dt.tm_mon >= 8 else now_dt.tm_year - 1
        y2 = y1 + 1
        current_db_key = f"mastercom_{y1}_{y2}"

        payload = {
            "user": self.user,
            "password_user": self.password,
            "db_key": current_db_key,    
            "login_ts": str(int(time.time())),
            "form_login": "true"
        }
        res = self.session.post(self.url, data=payload)
        res.encoding = 'utf-8'
        soup = BeautifulSoup(res.text, 'html.parser')
        
        try:
            self.data_session = {
                "current_key": soup.find('input', {'id': 'current_key'})['value'],
                "current_user": soup.find('input', {'id': 'current_user'})['value'],
                "db_key": soup.find('input', {'id': 'db_key'})['value']
            }
            
            user_info = {"name": "Studente", "foto": None}
            try:
                strong_tag = soup.find('strong', class_='text-mastercom-dark-blue')
                if strong_tag:
                    name_txt = strong_tag.text.strip()
                    if name_txt.lower().startswith("ciao "):
                        name_txt = name_txt[5:].strip()
                    user_info["name"] = name_txt
                    
                img_tag = soup.find('img', src=re.compile(r'foto_studenti'))
                if img_tag and 'src' in img_tag.attrs:
                    user_info["foto"] = "https://agnelli-to.registroelettronico.com/mastercom/" + img_tag['src']
            except Exception:
                pass
                
            self.data_session["user_info"] = user_info
            return True
        except (TypeError, KeyError):
            return False

    ### INTERNAL: SAFE REQUEST ###

    def _safe_request(self, stato_principale, extra_files=None):
        if not self.data_session: return None

        files = {
            'form_stato': (None, 'studente'),
            'stato_principale': (None, stato_principale),
            'stato_secondario': (None, ''),
            'permission': (None, 'nexus'),
            'operazione': (None, ''),
            'current_user': (None, self.data_session["current_user"]),
            'current_key': (None, self.data_session["current_key"]),
            'from_app': (None, '1'),
            'webview': (None, '1'),
            'header': (None, 'SI'),
            'db_key': (None, self.data_session.get("db_key", ""))
        }

        if extra_files:
            files.update(extra_files)

        res = self.session.post(self.url, headers=self.ajax_headers, files=files)
        text_lower = res.text.lower()
        
        # Gestione race condition e sessioni invalidate
        if not res.text or 'sincronizzazione' in text_lower or 'form_login' in text_lower:
            # Token invalidato o scaduto. Ritentiamo una volta con nuovo login
            if self.login():
                files['current_user'] = (None, self.data_session["current_user"])
                files['current_key'] = (None, self.data_session["current_key"])
                files['db_key'] = (None, self.data_session.get("db_key", ""))
                res = self.session.post(self.url, headers=self.ajax_headers, files=files)
            else:
                return None

        return res

    ### DATI ###

    def prendi_voti(self):
        res = self._safe_request('voti')
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', attrs={'data-tipo': 'voto'})
        
        risultati = []
        for riga in righe:
            materia = riga.find('div', class_='bold').text.strip()
            voto = riga.find('strong').text.strip()
            testo_div = riga.find_all('div')[2].text.strip()
            
            m = re.match(r"(\d{2}/\d{2}/\d{4})\s*(.*)", testo_div)
            if m:
                data = m.group(1)
                tipo = m.group(2) if m.group(2) else "—"
            else:
                data = testo_div[:10]
                tipo = testo_div[10:] if len(testo_div) > 10 else "—"
            
            peso_zero = "Il voto non fa media" in riga.text
            
            # Pulizia e calcolo valore float
            valore = None
            voto_match = re.search(r"(\d+)", voto)
            if voto_match:
                base_voto = float(voto_match.group(1))
                if any(x in voto for x in ["½", "1/2", ".5", "mezzo"]):
                    valore = base_voto + 0.5
                elif "+" in voto:
                    valore = base_voto + 0.25
                elif "-" in voto:
                    valore = base_voto - 0.25
                elif "/" in voto:
                    parts = re.findall(r"\d+", voto)
                    if len(parts) >= 2:
                        valore = (float(parts[0]) + float(parts[1])) / 2.0
                else:
                    m_comma = re.search(r"(\d+)[\.,](\d+)", voto)
                    if m_comma:
                        valore = float(f"{m_comma.group(1)}.{m_comma.group(2)}")
                    else:
                        valore = base_voto
            
            # Ricerca eventuale descrizione/commento (di solito oltre il 3° div)
            descrizione = ""
            divs = riga.find_all('div')
            if len(divs) > 3:
                desc_parts = []
                for d in divs[3:]:
                    txt = d.get_text(" ", strip=True)
                    if txt and "Il voto non fa media" not in txt:
                        if txt.lower() not in ["scritto", "orale", "pratico", "grafico", "test", "interrogazione"]:
                            desc_parts.append(txt)
                descrizione = " | ".join(desc_parts)
                
            # Fallback se la descrizione è in uno span o i
            if not descrizione:
                extra_tags = riga.find_all(['i', 'small'])
                if extra_tags:
                    desc_parts = []
                    for t in extra_tags:
                        txt = t.get_text(strip=True)
                        if txt and txt.lower() not in ["scritto", "orale", "pratico", "grafico", "test", "interrogazione"]:
                            desc_parts.append(txt)
                    descrizione = " | ".join(desc_parts)
            # Pulizia eventuale del tipo qualora sia incastrato ma non sia l'intera stringa
            if descrizione and tipo and tipo.strip() != "—" and len(tipo.strip()) > 3:
                descrizione = re.sub(rf"(?i)\b{re.escape(tipo.strip())}\b", "", descrizione).strip(' |')

            # Estrazione Peso (es 20%, 50%...)
            peso = 1.0
            peso_match = re.search(r"(\d+)%", riga.text)
            if peso_match:
                peso = float(peso_match.group(1)) / 100.0

            risultati.append({
                "materia": materia, 
                "voto": voto, 
                "valore": valore,
                "data": data, 
                "tipo": tipo, 
                "peso": peso,
                "peso_zero": peso_zero,
                "descrizione": descrizione
            })
        
        return risultati

    def get_assenze(self):
        res = self._safe_request('assenze')
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', attrs={'data-giustificata': True})
        
        risultati = []
        for riga in righe:
            tds = riga.find_all('td')
            if len(tds) < 3: continue
            
            tipo = tds[0].find('strong').text.strip()
            data = riga.get('data-date', '')
            descrizione = tds[2].get_text(" ", strip=True).replace("Giustificata", "").strip()
            giustificata = riga.get('data-giustificata') == "1"
            
            risultati.append({
                "tipo": tipo,
                "data": data,
                "descrizione": descrizione,
                "giustificata": giustificata
            })
        return risultati

    def get_agenda(self):
        res = self._safe_request('agenda')
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', class_='border-bottom')
        risultati = []

        for riga in righe:
            tds = riga.find_all('td')
            if len(tds) < 2: continue

            data_raw = tds[0].get_text(separator=" ", strip=True)
            data_pulita = " ".join(data_raw.replace("OGGI", "").split())
            eventi = tds[1].find_all('div', attrs={'data-type': True})

            for evento in eventi:
                tipo = evento.get('data-type', '')
                orario_div = evento.find('div', class_='right')
                orario = orario_div.get_text(separator=" - ", strip=True) if orario_div else ""
                titolo_tag = evento.find('strong')
                titolo = titolo_tag.get_text(strip=True) if titolo_tag else ""
                autore_tag = evento.find('i', class_='small')
                autore = autore_tag.get_text(strip=True).strip("()") if autore_tag else ""

                risultati.append({
                    "data": data_pulita,
                    "tipo": tipo,
                    "orario": orario,
                    "titolo": titolo,
                    "docente": autore
                })
        return risultati
    
    def get_argomenti_compiti(self):
        res = self._safe_request('argomenti-compiti')
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        righe = soup.find_all('tr', class_='border-bottom')
        risultati = []
        data_corrente = ""

        for riga in righe:
            tds = riga.find_all('td')
            if not tds: continue
            
            if len(tds) == 2:
                data_col = tds[0]
                content_col = tds[1]
                strong_tag = data_col.find('strong')
                if strong_tag:
                     data_testo = strong_tag.get_text(separator=" ", strip=True)
                else:
                     data_testo = data_col.get_text(separator=" ", strip=True)
                data_corrente = " ".join(data_testo.replace("OGGI", "").split())
            elif len(tds) == 1:
                content_col = tds[0]
            else:
                continue

            materia_tag = content_col.find('strong')
            materia = materia_tag.text.strip() if materia_tag else "Sconosciuta"
            blocchi = content_col.find_all('div', attrs={'data-type': True})

            for blocco in blocchi:
                tipo = blocco.get('data-type')
                testo_completo = blocco.get_text(separator="\n", strip=True)
                docente_tag = blocco.find('i', class_='text-gray')
                docente = docente_tag.text.strip() if docente_tag else ""
                contenuto = testo_completo.replace(docente, "").strip()
                if contenuto.startswith("- "):
                    contenuto = contenuto[2:]
                
                stato = ""
                if tipo == "assegnazione":
                    label = blocco.find('label')
                    if label:
                        stato_span = label.find('span')
                        if stato_span:
                            stato = stato_span.text.strip()
                            contenuto = contenuto.replace(stato, "").strip()
                    inserito_tag = blocco.find('span', class_='text-gray small')
                    if inserito_tag:
                         contenuto = contenuto.replace(inserito_tag.text, "").strip()

                docente_pulito = docente.strip().strip("()")
                contenuto_pulito = contenuto.replace('\r', '').replace('\n', ' | ').strip(' |')

                risultati.append({
                    "data": data_corrente,
                    "materia": materia,
                    "tipo": tipo,
                    "contenuto": contenuto_pulito,
                    "docente": docente_pulito,
                    "stato": stato
                })
        return risultati

    def get_notizie(self):
        extra = {
            'stato_secondario': (None, 'in_arrivo'),
            'chat': (None, 'NO'),
            'padding-bottom': (None, '15')
        }
        res = self._safe_request('messenger', extra_files=extra)
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        notizie = []
        
        tabella = soup.find('table', id='tabella_messaggi')
        if not tabella:
            return []
            
        righe = tabella.find_all('tr', attrs={'data-idmess': True})
        for r in righe:
            tds = r.find_all('td')
            if len(tds) >= 3:
                divs = tds[1].find_all('div')
                if len(divs) >= 2:
                    mittente = divs[0].get_text(strip=True)
                    oggetto = divs[1].get_text(separator=" ", strip=True)
                    oggetto = re.sub(r'^\d+\s+', '', oggetto)
                    has_attachment = bool(tds[1].find('i', class_='fa-paperclip'))
                    data_str = tds[2].get_text(strip=True)

                    # --- Cerca id_tread con molteplici strategie ---
                    id_tread = ''

                    # 1. Attributo diretto sulla riga (varie varianti del nome)
                    for attr_name in ('data-idtread', 'data-id-tread', 'data-tread',
                                      'data-idtred', 'data-thread'):
                        val = r.get(attr_name, '')
                        if val:
                            id_tread = val
                            break

                    # 2. Onclick sulla riga o nei suoi figli
                    if not id_tread:
                        # Cerca in riga + tutti i figli
                        nodes = [r] + r.find_all(True)
                        for node in nodes:
                            oc = node.get('onclick', '') or ''
                            # Pattern: apriTread('21105','30614',...) o apriMessaggio(21105,...)
                            m_oc = re.search(
                                r"(?:apriTread|apriMessaggio|openTread|apri_tread)"
                                r"\(['\"]?(\d+)",
                                oc, re.IGNORECASE
                            )
                            if m_oc:
                                id_tread = m_oc.group(1)
                                break

                    # 3. href su link della riga
                    if not id_tread:
                        for a in r.find_all('a', href=True):
                            m_href = re.search(r'id_tread[=:]?(\d+)', a['href'])
                            if m_href:
                                id_tread = m_href.group(1)
                                break

                    notizie.append({
                        "id":       r.get('data-idmess'),
                        "id_tread": id_tread,
                        "mittente": mittente,
                        "oggetto":  oggetto,
                        "data":     data_str,
                        "allegati": has_attachment
                    })
        return notizie

    def leggi_notizia(self, id_messaggio, id_tread=''):
        if not self.data_session:
            return {"error": "Sessione non inizializzata", "html": "", "allegati": []}

        # POST diretta — bypass _safe_request per evitare falsi positivi
        # sulla parola "sincronizzazione" che appare normalmente nell'HTML del tread.
        files = {
            'filtro_cerca':    (None, ''),
            'pagina':          (None, '1'),
            'start_messenger': (None, '0'),
            'form_stato':      (None, 'studente'),
            'stato_principale':(None, 'messenger'),
            'stato_secondario':(None, 'in_arrivo'),
            'operazione':      (None, ''),
            'chat':            (None, 'SI'),
            'id_tread':        (None, str(id_tread)),
            'id_messaggio':    (None, str(id_messaggio)),
            'db_messaggio':    (None, self.data_session.get('db_key', 'mastercom_2025_2026')),
            'tipo_messaggio':  (None, 'NORMALE'),
            'current_user':    (None, self.data_session['current_user']),
            'current_key':     (None, self.data_session['current_key']),
            'from_app':        (None, '1'),
            'padding-bottom':  (None, '15'),
            'header':          (None, 'SI'),
        }

        try:
            res = self.session.post(self.url, headers=self.ajax_headers, files=files)
        except Exception as e:
            return {"error": f"Errore di rete: {e}", "html": "", "allegati": []}

        # Sessione scaduta
        if not res.text or 'form_login' in res.text.lower():
            if self.login():
                files['current_user'] = (None, self.data_session['current_user'])
                files['current_key']  = (None, self.data_session['current_key'])
                try:
                    res = self.session.post(self.url, headers=self.ajax_headers, files=files)
                except Exception as e:
                    return {"error": f"Errore rete dopo re-login: {e}", "html": "", "allegati": []}
            else:
                return {"error": "Sessione scolastica scaduta", "html": "", "allegati": []}

        soup = BeautifulSoup(res.text, 'html.parser')

        # --- Rileva se il server ha risposto con la lista invece del tread ---
        # Questo succede se id_tread è mancante o errato.
        if soup.find('table', id='tabella_messaggi'):
            debug_snippet = res.text[:500].replace('\n', ' ')
            return {
                "error": (
                    f"Il server ha restituito la lista messaggi invece del contenuto del messaggio. "
                    f"id_tread ricevuto: '{id_tread}', id_messaggio: '{id_messaggio}'. "
                    f"Snippet HTML: {debug_snippet}"
                ),
                "html": "",
                "allegati": [],
                "debug": {
                    "id_tread": id_tread,
                    "id_messaggio": id_messaggio,
                    "html_snippet": debug_snippet
                }
            }

        # --- Corpo del messaggio ---
        testo_div = soup.find('div', class_='corpo')
        if not testo_div:
            testo_div = soup.find(id='testo_messaggio')
        if not testo_div:
            testo_div = soup.find('div', class_=re.compile(r'contenuto|body|card-body'))

        if testo_div:
            # Strip attributi class/style/id per non ereditare lo stile della scuola
            for tag in testo_div.find_all(True):
                for attr in list(tag.attrs.keys()):
                    if attr.lower() in ('class', 'style', 'id', 'bgcolor', 'color',
                                        'background', 'width', 'height', 'align', 'valign'):
                        del tag.attrs[attr]
            html_content = "".join([str(t) for t in testo_div.contents])
        else:
            # Fallback estremo: cerca almeno il testo del messaggio-tread
            msg_div = soup.find('div', class_='messaggio-tread')
            if msg_div:
                html_content = msg_div.get_text(separator='<br>', strip=True)
            else:
                # Nessun contenuto trovato — ritorna debug
                debug_snippet = res.text[:800].replace('\n', ' ')
                return {
                    "error": (
                        f"Struttura HTML non riconosciuta. "
                        f"id_tread: '{id_tread}', id_messaggio: '{id_messaggio}'. "
                        f"Snippet: {debug_snippet}"
                    ),
                    "html": "",
                    "allegati": [],
                    "debug": {"html_snippet": debug_snippet}
                }

        # Pulizia script e tag inutili
        html_content = re.sub(r'<script.*?>.*?</script>', '', html_content,
                               flags=re.DOTALL | re.IGNORECASE)

        # --- Allegati ---
        allegati = []
        seen_keys = set()

        # Raccoglie tutti i div/elementi allegato e tag <a>
        div_allegati = soup.find_all(lambda tag: tag.name in ('div', 'tr', 'li') and any('allegat' in c.lower() for c in tag.get('class', [])))
        link_allegati = soup.find_all('a', href=True)
        
        candidate_elements = list(div_allegati)
        for a_tag in link_allegati:
            href_low = a_tag['href'].lower()
            if any(k in href_low for k in ('next-api/v1/download', 'download_documento.php', 's3.', 'io.cloud.ovh.net', 'scarica_allegato', 'id_allegato', 'id_documento', 'attachment')):
                if a_tag not in candidate_elements:
                    candidate_elements.append(a_tag)

        for el in candidate_elements:
            id_file = None
            app_name = 'messenger'
            url_direct = None
            nome = ''

            # 1. Ricerca del nome dell'allegato
            td_name = el.find('td', colspan=True) if hasattr(el, 'find') else None
            if td_name:
                nome = td_name.get_text(strip=True)
            elif hasattr(el, 'get_text'):
                raw_txt = el.get_text(separator=' ', strip=True)
                clean_txt = re.sub(r'(?i)\bscarica\b|\b\d{4,}\b|\bdownload\b', '', raw_txt).strip()
                if clean_txt and len(clean_txt) < 150:
                    nome = clean_txt

            # 2. Check onclick
            onclick = el.get('onclick', '') if hasattr(el, 'get') else ''
            if onclick:
                m1 = re.search(r"downloadFile\('([^']+)',\s*'([^']+)'\)", onclick)
                if m1:
                    id_file = m1.group(1)
                    app_name = m1.group(2)
                else:
                    m2 = re.search(r"next-api/v1/download/(\d+)", onclick)
                    if m2:
                        id_file = m2.group(1)
                    else:
                        m3 = re.search(r"id(?:_documento|_allegato|_file)?[:=]\s*'?(\d+)'?", onclick)
                        if m3:
                            id_file = m3.group(1)

            # 3. Check href su <a>
            a_sub = el if el.name == 'a' else (el.find('a', href=True) if hasattr(el, 'find') else None)
            if a_sub and a_sub.has_attr('href'):
                href_val = a_sub['href']
                m_next = re.search(r"next-api/v1/download/(\d+)", href_val)
                if m_next:
                    id_file = m_next.group(1)
                else:
                    m_param = re.search(r"(?:id_documento|id_allegato|id_file|attachment[s]?/)=(\d+)", href_val)
                    if m_param:
                        id_file = m_param.group(1)
                    elif href_val.startswith('http://') or href_val.startswith('https://'):
                        url_direct = href_val
                
                if not nome:
                    link_txt = a_sub.get_text(strip=True)
                    if link_txt and len(link_txt) < 150 and 'scarica' not in link_txt.lower():
                        nome = link_txt

            # 4. Check data attributes
            if hasattr(el, 'get'):
                for attr in ('data-id', 'data-id-allegato', 'data-id-documento', 'data-idfile', 'data-idmess'):
                    val = el.get(attr)
                    if val and val.isdigit():
                        id_file = val
                        break

            # 5. Fallback nome
            if not nome:
                nome = f"Allegato {id_file}" if id_file else "Allegato Documento"

            if url_direct:
                url_direct = url_direct.replace('&amp;', '&')
                if 's3.' in url_direct or 'io.cloud.ovh.net' in url_direct:
                    url_direct = re.sub(r'[&?]visualizza_app=[^&]*', '', url_direct)

            key = id_file or url_direct
            if key and key not in seen_keys:
                seen_keys.add(key)
                
                if id_file:
                    dl_url = f"/api/notizia/download?id_file={id_file}&app={app_name}&nome={urllib.parse.quote(nome)}"
                    next_api_url = f"https://agnelli-to.registroelettronico.com/next-api/v1/download/{id_file}?direct=true"
                else:
                    dl_url = f"/api/notizia/download?url={urllib.parse.quote(url_direct)}&nome={urllib.parse.quote(nome)}"
                    next_api_url = url_direct

                allegati.append({
                    "id_file": id_file,
                    "nome": nome,
                    "url": dl_url,
                    "next_api_url": next_api_url,
                    "raw_url": url_direct
                })

        return {
            "html":     html_content.strip() or "Nessun testo presente in questo messaggio.",
            "allegati": allegati
        }

    def get_note(self):
        res = self._safe_request('note-disciplinari')
        if not res: return []

        if "Nessuna nota disciplinare trovata" in res.text:
            return []

        soup = BeautifulSoup(res.text, 'html.parser')
        note_set = set()
        # Cerchiamo solo le card "foglia" (che non contengono altre card all'interno)
        # per evitare che il testo venga duplicato prendendo sia il genitore che il figlio.
        elementi = soup.find_all('div', class_='card')
        for el in elementi:
            if not el.find('div', class_='card'):
                testo = el.get_text(separator=" ", strip=True)
                # Pulizia stringhe vuote o placeholder
                if testo and len(testo) > 5 and "Nessuna nota" not in testo:
                    note_set.add(testo)
        
        # Ritorna lista di dizionari unica
        return [{"contenuto": t} for t in note_set]

    def get_orario(self):
        res = self._safe_request('orario')
        if not res: return []

        m = re.search(r"var\s+riepilogo_orario\s*=\s*JSON\.parse\('([^']+)'\)", res.text)
        if not m:
            return []
            
        try:
            orario_str = m.group(1).encode().decode('unicode_escape')
            data = json.loads(orario_str)
            return data.get('elenco_ore_totale', [])
        except Exception:
            return []

    def get_corsi(self):
        res = self._safe_request('corsi')
        if not res: return []

        soup = BeautifulSoup(res.text, 'html.parser')
        
        corsi = []
        rows = soup.select('table.table.striped tr')
        for row in rows:
            tds = row.find_all('td')
            if len(tds) < 2: continue
            
            titolo_el = tds[0].find('strong')
            if not titolo_el: continue
            titolo = titolo_el.get_text(strip=True)
            
            prof_el = tds[0].find('div', class_='italic small')
            professore = prof_el.get_text(separator=" ", strip=True) if prof_el else ""
            
            btn = tds[0].find('button', onclick=re.compile(r'toggleInfo'))
            id_corso = ""
            if btn:
                m = re.search(r"toggleInfo\([^,]+,\s*'(\d+)'\)", btn['onclick'])
                if m: id_corso = m.group(1)
                
            dettagli = ""
            if id_corso:
                dettagli_div = soup.find('div', id=id_corso)
                if dettagli_div:
                    dettagli = dettagli_div.get_text(separator="\n", strip=True)
            
            date_div = tds[1].find('div')
            date_testo = date_div.get_text(separator=" - ", strip=True) if date_div else ""
            
            iscritto = False
            iscrizione_div = tds[1].find('div', id=f"div_iscrizione_{id_corso}")
            if iscrizione_div:
                testo_iscr = iscrizione_div.get_text(strip=True)
                if "Non iscritto" not in testo_iscr and "Iscritto" in testo_iscr:
                    iscritto = True
                    
            corsi.append({
                "id": id_corso,
                "titolo": titolo,
                "professore": professore,
                "dettagli": dettagli,
                "periodo": date_testo,
                "iscritto": iscritto
            })
            
        return corsi

    def toggle_corso(self, id_corso, action="subscribe"):
        extra = {
            'operazione': (None, action),
            'id_corso': (None, id_corso)
        }
        res = self._safe_request('corsi', extra_files=extra)
        return res is not None

    def get_badge(self):
        """
        Recupera il codice a barre per la tessera mensa e il badge dello studente.
        Interroga anche _safe_request('badge') con i parametri ufficiali Mastercom.
        """
        if not self.data_session:
            return {}

        badge_code = ""

        # 1. Esegui la richiesta form-data per lo stato 'badge' come da specifica Mastercom
        try:
            self._safe_request('badge')
        except Exception:
            pass

        # 2. Estrazione badgeValue dalla dashboard
        try:
            payload = {
                'form_stato': 'studente',
                'stato_principale': 'home',
                'current_user': self.data_session.get('current_user', ''),
                'current_key': self.data_session.get('current_key', ''),
                'db_key': self.data_session.get('db_key', ''),
                'tipo_utente': 'studente',
                'header': 'NO'
            }
            dash = self.session.post(self.url, data=payload, timeout=10)
            m = re.search(r"var\s+badgeValue\s*=\s*['\"]([^'\"]+)['\"]", dash.text)
            if m:
                badge_code = m.group(1).strip()
        except Exception:
            pass

        # Fallback 1: cerca badgeValue in qualsiasi risposta precedente
        if not badge_code:
            try:
                res = self._safe_request('badge')
                if res and res.text:
                    m = re.search(r"badgeValue\s*=\s*['\"]([^'\"]+)['\"]", res.text)
                    if m:
                        badge_code = m.group(1).strip()
            except Exception:
                pass

        # Fallback 2: identificativo studente
        if not badge_code and self.data_session.get("current_user"):
            badge_code = str(self.data_session.get("current_user", "")).strip()

        user_info = self.data_session.get("user_info", {})
        return {
            "codice": badge_code,
            "formato": "CODE128",
            "studente": user_info.get("name", "Studente"),
            "foto": user_info.get("foto", None),
            "current_user": self.data_session.get("current_user", "")
        }
