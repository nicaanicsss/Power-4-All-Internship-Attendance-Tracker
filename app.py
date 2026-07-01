import os
import psycopg2
import psycopg2.extras

import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = 'p4a_super_secret_key_intern_tracker' # In production, use os.urandom(24)

DB_PATH = 'database.sqlite'

class PgConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
    
    def execute(self, sql, params=()):
        cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(sql, params)
        return cursor
        
    def commit(self):
        self.conn.commit()
        
    def close(self):
        self.conn.close()
        
    def cursor(self):
        return self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def get_db():
    database_url = os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL', 'postgresql://localhost/attendance')
    conn = psycopg2.connect(database_url)
    return PgConnectionWrapper(conn)

def setup_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT,
            name TEXT,
            dept TEXT,
            school TEXT,
            intern_id TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            date TEXT,
            timeIn TEXT,
            timeOut TEXT,
            grossMins INTEGER,
            durationMins INTEGER,
            task TEXT,
            dept TEXT,
            learning TEXT,
            mood TEXT,
            type TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            text TEXT,
            priority TEXT,
            category TEXT,
            done INTEGER,
            cleared INTEGER,
            created_at TEXT,
            completed_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            user_id TEXT,
            achievement_id TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agendas (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT,
            date TEXT,
            time TEXT,
            category TEXT,
            priority TEXT,
            repeat TEXT,
            desc TEXT,
            location TEXT,
            notif INTEGER,
            done INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()

setup_db()

# ==================== STATIC FILES ====================
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return jsonify({"error": "File not found"}), 404

# ==================== AUTH ROUTES ====================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    dept = data.get('dept')
    school = data.get('school')
    intern_id = data.get('intern_id')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({'error': 'Email already registered'}), 400

    user_id = str(uuid.uuid4())
    pw_hash = generate_password_hash(password)

    cursor.execute("""
        INSERT INTO users (id, email, password_hash, role, name, dept, school, intern_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (user_id, email, pw_hash, 'intern', name, dept, school, intern_id))
    
    conn.commit()
    conn.close()

    session['user_id'] = user_id
    session['role'] = 'intern'
    return jsonify({'success': True, 'user': {'id': user_id, 'email': email, 'name': name}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['role'] = user['role']
        return jsonify({
            'success': True, 
            'user': {
                'id': user['id'], 
                'email': user['email'], 
                'name': user['name'],
                'role': user['role']
            }
        })
    
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me', methods=['GET'])
def get_me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    user = conn.execute("SELECT id, email, role, name, dept, school, intern_id FROM users WHERE id = %s", (user_id,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    return jsonify({'user': dict(user)})

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    data = request.json
    conn = get_db()
    conn.execute("""
        UPDATE users 
        SET name = %s, dept = %s, school = %s, intern_id = %s
        WHERE id = %s
    """, (data.get('name'), data.get('dept'), data.get('school'), data.get('intern_id'), user_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== DATA ROUTES ====================
def check_auth():
    return session.get('user_id')

@app.route('/api/records', methods=['GET', 'POST'])
def handle_records():
    user_id = check_auth()
    if not user_id: return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    
    if request.method == 'GET':
        records = conn.execute("SELECT * FROM records WHERE user_id = %s", (user_id,)).fetchall()
        conn.close()
        return jsonify([dict(r) for r in records])
        
    if request.method == 'POST':
        # Replace all records (like localstorage did) or insert new.
        # Since script.js currently saves the whole array, we will replace for simplicity of migration.
        data = request.json
        conn.execute("DELETE FROM records WHERE user_id = %s", (user_id,))
        
        for r in data:
            conn.execute("""
                INSERT INTO records (id, user_id, date, timeIn, timeOut, grossMins, durationMins, task, dept, learning, mood, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                r.get('id', str(uuid.uuid4())), user_id, r.get('date'), r.get('timeIn'), 
                r.get('timeOut'), r.get('grossMins'), r.get('durationMins'), r.get('task'), 
                r.get('dept'), r.get('learning'), r.get('mood'), r.get('type', 'work')
            ))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/todos', methods=['GET', 'POST'])
def handle_todos():
    user_id = check_auth()
    if not user_id: return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    
    if request.method == 'GET':
        todos = conn.execute("SELECT * FROM todos WHERE user_id = %s ORDER BY created_at DESC", (user_id,)).fetchall()
        conn.close()
        return jsonify([dict(t) for t in todos])
        
    if request.method == 'POST':
        data = request.json
        conn.execute("DELETE FROM todos WHERE user_id = %s", (user_id,))
        for t in data:
            conn.execute("""
                INSERT INTO todos (id, user_id, text, priority, category, done, cleared, created_at, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                t.get('id', str(uuid.uuid4())), user_id, t.get('text'), t.get('priority'), 
                t.get('category'), 1 if t.get('done') else 0, 1 if t.get('cleared') else 0, 
                t.get('createdAt'), t.get('completedAt')
            ))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/achievements', methods=['GET', 'POST'])
def handle_achievements():
    user_id = check_auth()
    if not user_id: return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    
    if request.method == 'GET':
        rows = conn.execute("SELECT achievement_id FROM achievements WHERE user_id = %s", (user_id,)).fetchall()
        conn.close()
        return jsonify([a['achievement_id'] for a in rows])
        
    if request.method == 'POST':
        data = request.json # list of string IDs
        conn.execute("DELETE FROM achievements WHERE user_id = %s", (user_id,))
        for aid in data:
            conn.execute("INSERT INTO achievements (user_id, achievement_id) VALUES (%s, %s)", (user_id, aid))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/agendas', methods=['GET', 'POST'])
def handle_agendas():
    user_id = check_auth()
    if not user_id: return jsonify({'error': 'Not authenticated'}), 401
    
    conn = get_db()
    
    if request.method == 'GET':
        rows = conn.execute("SELECT * FROM agendas WHERE user_id = %s", (user_id,)).fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
        
    if request.method == 'POST':
        data = request.json
        conn.execute("DELETE FROM agendas WHERE user_id = %s", (user_id,))
        for r in data:
            conn.execute("""
                INSERT INTO agendas (id, user_id, title, date, time, category, priority, repeat, desc, location, notif, done)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(r.get('id', uuid.uuid4())), user_id, r.get('title'), r.get('date'), 
                r.get('time'), r.get('category'), r.get('priority'), r.get('repeat'), 
                r.get('desc'), r.get('location'), 1 if r.get('notif') else 0, 1 if r.get('done') else 0
            ))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

# ==================== ADMIN ROUTES ====================
@app.route('/api/admin/interns', methods=['GET'])
def get_admin_interns():
    user_id = session.get('user_id')
    role = session.get('role')
    if not user_id or role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    users = cursor.execute("SELECT id, name, dept, school, intern_id FROM users WHERE role = 'intern'").fetchall()
    
    interns_data = []
    for u in users:
        intern = dict(u)
        
        records = cursor.execute("SELECT id, date, timeIn, timeOut, grossMins, durationMins, task, learning, mood, type FROM records WHERE user_id = %s ORDER BY date DESC", (u['id'],)).fetchall()
        
        intern_records = [dict(r) for r in records]
        intern['records'] = intern_records
        intern['totalMins'] = sum(r['durationMins'] for r in intern_records if r['durationMins'])
        intern['lastActive'] = intern_records[0]['date'] if intern_records else 'Never'
        intern['isReal'] = True # Always true for DB users
        interns_data.append(intern)

    conn.close()
    return jsonify(interns_data)

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    if session.get('role') != 'admin': return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db()
    conn.row_factory = sqlite3.Row
    users = conn.execute("SELECT id, name, email, dept, role FROM users WHERE role IN ('admin', 'member') ORDER BY name ASC").fetchall()
    conn.close()
    
    return jsonify([dict(u) for u in users])

@app.route('/api/admin/users', methods=['POST'])
def admin_add_user():
    if session.get('role') != 'admin': return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    name = data.get('name')
    email = data.get('email')
    dept = data.get('dept')
    role = data.get('role')
    password = data.get('password')
    
    if not all([name, email, dept, role, password]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    pw_hash = generate_password_hash(password)
    user_id = 'usr-' + uuid.uuid4().hex[:12]
    
    conn = get_db()
    try:
        conn.execute("INSERT INTO users (id, email, password_hash, role, name, dept) VALUES (%s, %s, %s, %s, %s, %s)",
                     (user_id, email, pw_hash, role, name, dept))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Email already exists'}), 400
    
    conn.close()
    return jsonify({'success': True, 'id': user_id})

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    if session.get('role') != 'admin': return jsonify({'error': 'Unauthorized'}), 401
    
    # Prevent deleting yourself
    if session.get('user_id') == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
        
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/admin/records', methods=['POST'])
def admin_add_record():
    user_id = session.get('user_id')
    if session.get('role') != 'admin': return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    target_user_id = data.get('user_id')
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO records (id, user_id, date, timeIn, timeOut, grossMins, durationMins, task, learning, mood, type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (data['id'], target_user_id, data['date'], data['timeIn'], data['timeOut'], data['grossMins'], data['durationMins'], data['task'], data['learning'], data['mood'], data['type']))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/admin/records/<record_id>', methods=['DELETE'])
def admin_delete_record(record_id):
    if session.get('role') != 'admin': return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db()
    conn.execute("DELETE FROM records WHERE id = %s", (record_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== IMPORT ROUTE ====================
@app.route('/api/import', methods=['POST'])
def import_data():
    user_id = check_auth()
    if not user_id: return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.json
    conn = get_db()
    
    # 1. Update Profile if missing in DB
    if 'name' in data and data['name']:
        conn.execute("UPDATE users SET name=%s, dept=%s, school=%s, intern_id=%s WHERE id=%s", 
                     (data.get('name'), data.get('dept'), data.get('school'), data.get('intern_id'), user_id))
    
    # 2. Insert Records
    if data.get('records'):
        records = json.loads(data['records']) if isinstance(data['records'], str) else data['records']
        conn.execute("DELETE FROM records WHERE user_id = %s", (user_id,))
        for r in records:
            conn.execute("""
                INSERT INTO records (id, user_id, date, timeIn, timeOut, grossMins, durationMins, task, dept, learning, mood, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                r.get('id', str(uuid.uuid4())), user_id, r.get('date'), r.get('timeIn'), 
                r.get('timeOut'), r.get('grossMins'), r.get('durationMins'), r.get('task'), 
                r.get('dept'), r.get('learning'), r.get('mood'), r.get('type', 'work')
            ))
            
    # 3. Insert Todos
    if data.get('todos'):
        todos = json.loads(data['todos']) if isinstance(data['todos'], str) else data['todos']
        conn.execute("DELETE FROM todos WHERE user_id = %s", (user_id,))
        for t in todos:
            conn.execute("""
                INSERT INTO todos (id, user_id, text, priority, category, done, cleared, created_at, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(t.get('id', uuid.uuid4())), user_id, t.get('text'), t.get('priority'), 
                t.get('category'), 1 if t.get('done') else 0, 1 if t.get('cleared') else 0, 
                t.get('createdAt'), t.get('completedAt')
            ))

    # 4. Insert Achievements
    if data.get('achievements'):
        achievements = json.loads(data['achievements']) if isinstance(data['achievements'], str) else data['achievements']
        conn.execute("DELETE FROM achievements WHERE user_id = %s", (user_id,))
        for aid in achievements:
            conn.execute("INSERT INTO achievements (user_id, achievement_id) VALUES (%s, %s)", (user_id, aid))

    # 5. Insert Agendas
    if data.get('agendas'):
        agendas = json.loads(data['agendas']) if isinstance(data['agendas'], str) else data['agendas']
        conn.execute("DELETE FROM agendas WHERE user_id = %s", (user_id,))
        for r in agendas:
            conn.execute("""
                INSERT INTO agendas (id, user_id, title, date, time, category, priority, repeat, desc, location, notif, done)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                str(r.get('id', uuid.uuid4())), user_id, r.get('title'), r.get('date'), 
                r.get('time'), r.get('category'), r.get('priority'), r.get('repeat'), 
                r.get('desc'), r.get('location'), 1 if r.get('notif') else 0, 1 if r.get('done') else 0
            ))

    conn.commit()
    conn.close()
    return jsonify({'success': True})

try:
    setup_db()
except Exception as e:
    print("DB setup error:", e)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
