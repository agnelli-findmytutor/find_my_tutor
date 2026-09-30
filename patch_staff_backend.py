import re

def patch_backend():
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    new_endpoints = '''
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
        conn.execute("UPDATE fmt_appointments SET cancellation_notified = 1 WHERE id = ? AND user_id = ?", (app_id, request.current_user["id"]))
        conn.commit()
    return jsonify({"success": True})
'''

    if 'def fmt_admin_staff():' not in content:
        # Insert just before the end of the file or before the login endpoint
        content = content.replace('@app.route("/api/login", methods=["POST"])', new_endpoints + '\n@app.route("/api/login", methods=["POST"])')

    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)

patch_backend()
