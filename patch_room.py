import sqlite3
import uuid
import re

def patch_app():
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    room_logic = '''
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
'''
    
    # insert function before fmt_appointments
    if 'def calculate_room_assignment' not in content:
        content = content.replace('def fmt_appointments():', room_logic + '\n@app.route("/api/fmt/appointments", methods=["GET", "POST"])\ndef fmt_appointments():')
    
    # replace the INSERT query in fmt_appointments
    old_insert = '''        conn.execute("""
            INSERT INTO fmt_appointments (
                id, user_id, tutor_id, student_name, student_email, subject,
                date, time_slot, duration, status, tutor_name_cache, notes,
                is_group, group_members
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confermato', ?, ?, ?, ?)
        """, (app_id, user_id, tutor_id, student_name, student_email, subject,
              date_val, time_slot, duration, tutor_name_cache, notes, is_group, group_members))'''
              
    new_insert = '''        room_assign = calculate_room_assignment(conn, date_val, time_slot, duration, is_group, current_user.get('school_type'))
        conn.execute("""
            INSERT INTO fmt_appointments (
                id, user_id, tutor_id, student_name, student_email, subject,
                date, time_slot, duration, status, tutor_name_cache, notes,
                is_group, group_members, room_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confermato', ?, ?, ?, ?, ?)
        """, (app_id, user_id, tutor_id, student_name, student_email, subject,
              date_val, time_slot, duration, tutor_name_cache, notes, is_group, group_members, room_assign))'''
    
    if 'room_assign = calculate_room_assignment' not in content:
        content = content.replace(old_insert, new_insert)
        
    with open('app.py', 'w', encoding='utf-8') as f:
        f.write(content)
        
patch_app()
