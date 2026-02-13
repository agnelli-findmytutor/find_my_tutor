-- ==============================================================================
-- SCRIPT DI SICUREZZA SUPABASE (RLS & POLICIES)
-- ==============================================================================

-- 1. FUNZIONE HELPER ADMIN
-- Controlla se l'utente attuale ha il ruolo 'admin' nella tabella profiles.
-- SECURITY DEFINER: Esegue con i permessi del creatore per leggere profiles anche se RLS bloccasse.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ATTIVAZIONE RLS (ROW LEVEL SECURITY)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

-- PULIZIA VECCHIE POLICY (Per evitare errori in caso di ri-esecuzione)
DROP POLICY IF EXISTS "Admin All Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin All Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admin All Room Bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Read Own Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Student Create Appointment" ON public.appointments;
DROP POLICY IF EXISTS "Tutor Manage Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Tutor Delete Appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public Read Room Bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Create Own Room Booking" ON public.room_bookings;
DROP POLICY IF EXISTS "Delete Own Room Booking" ON public.room_bookings;

-- 3. POLICY "GOD MODE" PER ADMIN
-- L'admin può fare tutto (SELECT, INSERT, UPDATE, DELETE) su tutte le tabelle.
CREATE POLICY "Admin All Profiles" ON public.profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Appointments" ON public.appointments FOR ALL USING (public.is_admin());
CREATE POLICY "Admin All Room Bookings" ON public.room_bookings FOR ALL USING (public.is_admin());

-- 4. POLICY UTENTI NORMALI (STUDENTI / TUTOR)

-- --- TABELLA PROFILES ---
-- Lettura pubblica (necessaria per vedere i tutor nella lista prenotazioni)
CREATE POLICY "Public Read Profiles" ON public.profiles
FOR SELECT USING (true);

-- Modifica consentita solo al proprietario del profilo
CREATE POLICY "Update Own Profile" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- --- TABELLA APPOINTMENTS ---
-- Lettura: Visibile solo se sei lo studente (user_id) o il tutor (tutor_id)
CREATE POLICY "Read Own Appointments" ON public.appointments
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = tutor_id);

-- Creazione: Solo lo studente può prenotare (user_id deve essere se stesso)
CREATE POLICY "Student Create Appointment" ON public.appointments
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Modifica: Solo il Tutor può modificare (es. note, stato)
CREATE POLICY "Tutor Manage Appointments" ON public.appointments
FOR UPDATE USING (auth.uid() = tutor_id);

-- Cancellazione: Solo il Tutor può cancellare (fisicamente)
CREATE POLICY "Tutor Delete Appointments" ON public.appointments
FOR DELETE USING (auth.uid() = tutor_id);

-- --- TABELLA ROOM BOOKINGS ---
-- Lettura pubblica (per vedere le aule occupate)
CREATE POLICY "Public Read Room Bookings" ON public.room_bookings
FOR SELECT USING (true);

-- Creazione: Solo a nome proprio
CREATE POLICY "Create Own Room Booking" ON public.room_bookings
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cancellazione: Solo le proprie prenotazioni
CREATE POLICY "Delete Own Room Booking" ON public.room_bookings
FOR DELETE USING (auth.uid() = user_id);

-- 5. TRIGGER ANTI-HACKER SUI RUOLI
-- Impedisce la modifica del campo 'role' da parte di non-admin

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se l'utente è admin, permetti qualsiasi modifica
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Se un utente normale prova a cambiare il ruolo (OLD.role != NEW.role)
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'VIOLAZIONE SICUREZZA: Non sei autorizzato a modificare il tuo ruolo.';
  END IF;

  -- Se non sta cambiando il ruolo, procedi pure (es. cambia nome o avatar)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi il trigger se esiste già per ricrearlo pulito
DROP TRIGGER IF EXISTS check_role_update ON public.profiles;

-- Applica il trigger PRIMA dell'aggiornamento
CREATE TRIGGER check_role_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_change();

-- 6. PROTEZIONE IDENTITÀ (NOME E EMAIL IMMODIFICABILI)
-- Assicura che full_name ed email corrispondano sempre all'account Google (auth.users)

-- A. Trigger per la tabella PROFILES
CREATE OR REPLACE FUNCTION public.protect_profile_identity()
RETURNS TRIGGER AS $$
BEGIN
  -- L'admin può modificare tutto (es. correzioni manuali)
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- L'utente normale NON può cambiare nome o email
  IF (NEW.full_name IS DISTINCT FROM OLD.full_name) OR (NEW.email IS DISTINCT FROM OLD.email) THEN
      RAISE EXCEPTION 'VIOLAZIONE: Non puoi modificare Nome o Email. Sono gestiti dal tuo account Google.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_identity ON public.profiles;
CREATE TRIGGER check_profile_identity
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_identity();

-- B. Trigger per la tabella TUTOR_REQUESTS
-- Se un hacker prova a inviare una candidatura con un nome falso, lo sovrascriviamo con quello vero.
CREATE OR REPLACE FUNCTION public.force_request_identity()
RETURNS TRIGGER AS $$
DECLARE
  real_name text;
  real_email text;
BEGIN
  -- Recupera i dati sicuri da auth.users
  SELECT raw_user_meta_data->>'full_name', email 
  INTO real_name, real_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Sovrascrivi i campi con i dati ufficiali (se trovati)
  IF real_name IS NOT NULL THEN
    NEW.full_name := real_name;
  END IF;
  
  IF real_email IS NOT NULL THEN
    NEW.email := real_email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secure_tutor_request_identity ON public.tutor_requests;
CREATE TRIGGER secure_tutor_request_identity
BEFORE INSERT OR UPDATE ON public.tutor_requests
FOR EACH ROW
EXECUTE FUNCTION public.force_request_identity();

-- 7. PROTEZIONE DATI SENSIBILI (RLS MANCANTI)
-- Blocca l'accesso via Network alle tabelle amministrative

ALTER TABLE public.tutor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_tutors_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_ratings ENABLE ROW LEVEL SECURITY;

-- Policy Tutor Requests (Solo Admin vede tutto, Utente vede solo le sue)
CREATE POLICY "Admin Manage Requests" ON public.tutor_requests FOR ALL USING (public.is_admin());
CREATE POLICY "User Create Request" ON public.tutor_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User View Own Request" ON public.tutor_requests FOR SELECT USING (auth.uid() = user_id);

-- Policy Banned Logs (Solo Admin vede tutto, Utente vede solo il suo ban)
CREATE POLICY "Admin Manage Bans" ON public.banned_tutors_log FOR ALL USING (public.is_admin());
CREATE POLICY "User View Own Ban" ON public.banned_tutors_log FOR SELECT USING (auth.uid() = user_id);

-- Policy Ratings (Recensioni)
CREATE POLICY "Admin Manage Ratings" ON public.tutor_ratings FOR ALL USING (public.is_admin());
CREATE POLICY "Public View Ratings" ON public.tutor_ratings FOR SELECT USING (true);
-- Solo chi ha fatto una lezione può recensire (controllo base su auth)
CREATE POLICY "Student Create Rating" ON public.tutor_ratings FOR INSERT WITH CHECK (auth.uid() = auth.uid());

-- FINE SCRIPT