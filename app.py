from flask import Flask, render_template, request, jsonify
import requests
from database import get_db_connection, init_db
import os
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from mystery_engine import get_all_mysteries, unlock_mystery, complete_mystery, get_story_chapter, get_current_chapter, get_completed_chapters
from init_mysteries import init_mysteries

app = Flask(__name__)

if not os.path.exists('escape_realm.db'):
    init_db()
else:
    conn = get_db_connection()
    try:
        conn.execute("SELECT parallel_unlocked FROM users LIMIT 1")
    except:
        conn.execute("ALTER TABLE users ADD COLUMN parallel_unlocked INTEGER DEFAULT 0")
        conn.commit()
    try:
        conn.execute("SELECT game_completed FROM users LIMIT 1")
    except:
        conn.execute("ALTER TABLE users ADD COLUMN game_completed INTEGER DEFAULT 0")
        conn.commit()
    conn.close()

@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username, password = data.get('username'), data.get('password')
    if not username or not password: return jsonify({"error": "請提供帳號與密碼"}), 400
    conn = get_db_connection()
    if conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone():
        conn.close()
        return jsonify({"error": "此代號已被註冊"}), 409
    hashed_pw = generate_password_hash(password)
    conn.execute('INSERT INTO users (username, password_hash, streak_count) VALUES (?, ?, 0)', (username, hashed_pw))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "註冊成功"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username, password = data.get('username'), data.get('password')
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    
    if user and check_password_hash(user['password_hash'], password):
        today = date.today()
        last_login_str = user['last_login']
        streak = user['streak_count'] or 0
        streak_broken = False
        if last_login_str:
            last_login_date = date.fromisoformat(last_login_str)
            if last_login_date < today - timedelta(days=1):
                streak = 0
                streak_broken = True
                conn.execute('UPDATE users SET streak_count = 0 WHERE id = ?', (user['id'],))
                conn.commit()
        parallel_unlocked = user['parallel_unlocked'] or 0
        if streak >= 3 and not parallel_unlocked:
            parallel_unlocked = 1
            conn.execute('UPDATE users SET parallel_unlocked = 1 WHERE id = ?', (user['id'],))
            conn.commit()
        user_dict = dict(user)
        user_dict['streak_count'] = streak
        user_dict['streak_broken'] = streak_broken
        user_dict['parallel_unlocked'] = parallel_unlocked
        user_dict.pop('password_hash', None)
        next_badge = conn.execute('SELECT name, required_streak FROM badges WHERE required_streak > ? ORDER BY required_streak ASC LIMIT 1', (streak,)).fetchone()
        user_dict['next_badge'] = dict(next_badge) if next_badge else None
        conn.close()
        return jsonify(user_dict)
        
    conn.close()
    return jsonify({"error": "登入失敗"}), 401

@app.route('/api/moods', methods=['GET', 'POST'])
def handle_moods():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        user_id = data.get('user_id')
        today = date.today()
        today_str = today.isoformat()
        user = conn.execute('SELECT streak_count, last_login, parallel_unlocked FROM users WHERE id = ?', (user_id,)).fetchone()
        
        last_login_str = user['last_login']
        # 新增限制：如果今天的日期已經簽到過了，回傳錯誤並中斷
        if last_login_str == today_str:
            conn.close()
            return jsonify({"error": "今日已完成情緒同步，請明日再試"}), 400
            
        streak = user['streak_count'] or 0
        if last_login_str:
            last_login = date.fromisoformat(last_login_str)
            if last_login == today - timedelta(days=1): streak += 1
            elif last_login < today - timedelta(days=1): streak = 1
        else: streak = 1
            
        conn.execute('UPDATE users SET streak_count = ?, last_login = ? WHERE id = ?', (streak, today.isoformat(), user_id))
        
        parallel_unlocked = user['parallel_unlocked'] or 0
        if streak >= 3 and not parallel_unlocked:
            parallel_unlocked = 1
            conn.execute('UPDATE users SET parallel_unlocked = 1 WHERE id = ?', (user_id,))
        
        new_badge = None
        badges = conn.execute('SELECT * FROM badges WHERE required_streak <= ?', (streak,)).fetchall()
        for b in badges:
            if not conn.execute('SELECT * FROM user_badges WHERE user_id=? AND badge_id=?', (user_id, b['id'])).fetchone():
                conn.execute('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', (user_id, b['id']))
                new_badge = b['name']
        
        # 新增 note 欄位
        note = data.get('note', '')
        conn.execute('INSERT INTO moods (user_id, mood_type, emoji, lat, lng, location_name, note) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    (user_id, data.get('mood_type'), data.get('emoji'), data.get('lat'), data.get('lng'), data.get('location_name', 'Location'), note))
        conn.commit()
        
        mystery_event = None
        # 當剛好達到 7 天時，觸發分析報告與平行世界
        if streak == 7:
            # 獲取過去 7 天的紀錄來生成短文
            recent_moods = conn.execute('SELECT mood_type, note FROM moods WHERE user_id = ? ORDER BY created_at DESC LIMIT 7', (user_id,)).fetchall()
            
            if recent_moods:
                mood_counts = {}
                notes = []
                for m in recent_moods:
                    t = m['mood_type']
                    mood_counts[t] = mood_counts.get(t, 0) + 1
                    if m['note']: notes.append(m['note'])
                    
                dominant_mood = max(mood_counts, key=mood_counts.get)
                
                report = ">>> 神經鏈結記憶深度解析完成 <<<\n\n"
                report += f"在過去的七個觀測週期中，你的心智矩陣最常散發出的波動訊號是「{dominant_mood}」。\n\n"
                
                if dominant_mood in ['開心', '亢奮']:
                    report += "這是一段充滿高頻能量的旅程。即使現實充滿了雜訊，你依然維持著耀眼的光芒。平行世界的門扉已為你敞開，請將這份純粹的力量帶入未知的領域。"
                elif dominant_mood in ['平靜']:
                    report += "你的情緒如靜水流深。在混沌的現實與數據的洪流中，你找到了絕佳的平衡點。這份寧靜將是你探索平行世界最強大的防護盾。"
                elif dominant_mood in ['疲憊', '迷惘']:
                    report += "系統偵測到大量的精神能量耗損。這七天裡你承載了過多的重擔，神經網路邊緣已出現磨損。平行世界的縫隙正是為了讓你逃離片刻而開啟的，卸下裝甲，去那裡好好休息吧。"
                else:
                    report += "劇烈的情緒風暴席捲了你的心智。我們偵測到現實對你的強烈壓迫，但請記住，每一次情感的爆發與釋放，都是為了在平行世界中重塑一個更強大的自我。"
                
                if notes:
                    import random
                    report += f"\n\n[ 系統碎片攔截 ] 殘留於潛意識的心聲：\n「... {random.choice(notes)} ...」"
            else:
                report = "數據不足，無法解析記憶。"
                
            # 儲存報告到資料庫
            conn.execute('INSERT INTO reports (user_id, content) VALUES (?, ?)', (user_id, report))
            conn.commit()

            mystery_event = {
                "title": "ANOMALY_DETECTED", 
                "message": "連續記錄 7 天情緒，神經鏈結記憶深度解析完成！",
                "report": report
            }
        
        # 獲取下一個目標
        next_badge = conn.execute('SELECT name, required_streak FROM badges WHERE required_streak > ? ORDER BY required_streak ASC LIMIT 1', (streak,)).fetchone()
        conn.close()
        return jsonify({"status": "success", "streak": streak, "next_badge": dict(next_badge) if next_badge else None, "new_badge": new_badge, "mystery_event": mystery_event, "parallel_unlocked": parallel_unlocked})
    else:
        user_id = request.args.get('user_id')
        moods = conn.execute('SELECT * FROM moods WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
        conn.close()
        return jsonify([dict(m) for m in moods])

@app.route('/api/badges', methods=['GET'])
def get_badges():
    user_id = request.args.get('user_id')
    conn = get_db_connection()
    badges = conn.execute('''
        SELECT b.id, b.name, b.description, b.required_streak, ub.earned_at 
        FROM badges b 
        LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = ?
    ''', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(b) for b in badges])

@app.route('/api/reports', methods=['GET'])
def get_reports():
    user_id = request.args.get('user_id')
    conn = get_db_connection()
    reports = conn.execute('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reports])

@app.route('/api/route', methods=['GET'])
def get_route():
    coords = request.args.get('coords') 
    mode = request.args.get('mode', 'driving')
    strategy = request.args.get('strategy', 'sequential')
    if not coords: return jsonify({"error": "缺少座標資料"}), 400
    osrm_url = f"http://router.project-osrm.org/{'trip' if strategy == 'optimize' else 'route'}/v1/{mode}/{coords}?{'source=first&roundtrip=false&' if strategy == 'optimize' else ''}overview=full&geometries=geojson"
    try:
        response = requests.get(osrm_url)
        return jsonify(response.json())
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route("/api/story/<int:chapter_id>")
def api_story(chapter_id):
    chapter = get_story_chapter(chapter_id)
    if not chapter:
        return jsonify({"success": False}),404
    return jsonify({"success": True, "chapter": chapter})

#取得所有mystery
@app.route("/api/mysteries", methods=["GET"])
def api_get_mysteries():
    user_id = request.args.get("user_id")
    mysteries = get_all_mysteries(user_id)
    conn = get_db_connection()
    game_completed = conn.execute('SELECT game_completed FROM users WHERE id = ?', (user_id,)).fetchone()
    current_chapter = get_current_chapter(user_id)
    # 取得所有章節的謎團（讓地圖顯示舊章節藍點）
    all_mysteries = get_all_mysteries(user_id, all_chapters=True)
    conn.close()
    return jsonify({
        "success": True,
        "mysteries": mysteries,
        "all_mysteries": all_mysteries,
        "current_chapter": current_chapter,
        "game_completed": game_completed['game_completed'] if game_completed else 0
    })

#解鎖mystery
@app.route("/api/mysteries/<int:mystery_id>/unlock", methods=["POST"])
def api_unlock_mystery(mystery_id):
    data = request.json
    user_id = data.get("user_id")
    result = unlock_mystery(user_id, mystery_id)
    return jsonify(result)

#完成mystery
@app.route("/api/mysteries/<int:mystery_id>/complete", methods=["POST"])
def api_complete_mystery(mystery_id):
    data = request.json
    user_id = data.get("user_id")
    result = complete_mystery(user_id, mystery_id)
    return jsonify(result)

#計算哪些章節已完成
@app.route("/api/story/completed-chapters")
def api_completed_chapters():
    user_id = request.args.get("user_id")
    return jsonify({
        "success": True,
        "completed_chapters": get_completed_chapters(user_id)
    })

@app.route('/api/reset-test', methods=['POST'])
def api_reset_test():
    data = request.json
    account = data.get('account', 'BREAK_TEST')
    password = '123'
    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()

    if account == 'BREAK_TEST':
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (account,)).fetchone()
        if user:
            conn.execute('UPDATE users SET password_hash=?, streak_count=2, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                         (hashed_pw, yesterday, user['id']))
            conn.execute('DELETE FROM user_badges WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 2, ?, 0, 0)',
                         (account, hashed_pw, yesterday))
        msg = f'{account} / {password} → streak=2, 測平行世界解鎖'

    elif account == 'BROKEN_TEST':
        three_days_ago = (date.today() - timedelta(days=3)).isoformat()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (account,)).fetchone()
        if user:
            conn.execute('UPDATE users SET password_hash=?, streak_count=5, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                         (hashed_pw, three_days_ago, user['id']))
            conn.execute('DELETE FROM user_badges WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 5, ?, 0, 0)',
                         (account, hashed_pw, three_days_ago))
        msg = f'{account} / {password} → streak=0, 測中斷警示'

    elif account == 'SEVEN_TEST':
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (account,)).fetchone()
        if user:
            conn.execute('UPDATE users SET password_hash=?, streak_count=6, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                         (hashed_pw, yesterday, user['id']))
            conn.execute('DELETE FROM user_badges WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM moods WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 6, ?, 0, 0)',
                         (account, hashed_pw, yesterday))
        msg = f'{account} / {password} → streak=6, 測7天分析報告'

    elif account == 'VICTORY_TEST':
        today_str = date.today().isoformat()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (account,)).fetchone()
        if user:
            conn.execute('UPDATE users SET password_hash=?, streak_count=9, last_login=?, parallel_unlocked=1, game_completed=1 WHERE id=?',
                         (hashed_pw, today_str, user['id']))
            conn.execute('DELETE FROM user_badges WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 9, ?, 1, 1)',
                         (account, hashed_pw, today_str))
        user_row = conn.execute('SELECT id FROM users WHERE username = ?', (account,)).fetchone()
        uid = user_row['id']
        mysteries = conn.execute('SELECT id FROM mysteries WHERE is_active = 1').fetchall()
        for m in mysteries:
            conn.execute('INSERT OR IGNORE INTO mystery_progress (user_id, mystery_id, status, unlocked_at, completed_at) VALUES (?, ?, ?, ?, ?)',
                         (uid, m['id'], 'completed', today_str, today_str))
        msg = f'{account} / {password} → 全解完, 測慶祝畫面'

    else:
        conn.close()
        return jsonify({"error": "未知帳號"}), 400

    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": msg})


def setup_test_accounts():
    """每次啟動時自動建立/重置測試帳號"""
    today = date.today()
    conn = get_db_connection()

    accounts = [
        ('BREAK_TEST', 2, today - timedelta(days=1),
         'BREAK_TEST / 123 → streak=2, 測平行世界解鎖', False, False),
        ('BROKEN_TEST', 5, today - timedelta(days=3),
         'BROKEN_TEST / 123 → streak=0, 測中斷警示', False, False),
        ('SEVEN_TEST', 6, today - timedelta(days=1),
         'SEVEN_TEST / 123 → streak=6, 測7天分析報告', False, False),
        ('VICTORY_TEST', 9, today,
         'VICTORY_TEST / 123 → 全解完, 測慶祝畫面', True, True),
    ]

    for username, streak, last_login, msg, parallel, completed in accounts:
        hashed_pw = generate_password_hash('123')
        last_login_str = last_login.isoformat()
        user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
        if user:
            conn.execute('UPDATE users SET password_hash=?, streak_count=?, last_login=?, parallel_unlocked=?, game_completed=? WHERE id=?',
                         (hashed_pw, streak, last_login_str, 1 if parallel else 0, 1 if completed else 0, user['id']))
            conn.execute('DELETE FROM user_badges WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user['id'],))
            if username == 'SEVEN_TEST':
                conn.execute('DELETE FROM moods WHERE user_id=?', (user['id'],))
        else:
            conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, ?, ?, ?, ?)',
                         (username, hashed_pw, streak, last_login_str, 1 if parallel else 0, 1 if completed else 0))
        print(f'  [OK] {msg}')

        # 如果是全解帳號，插入所有 mystery 的完成紀錄
        if completed and username == 'VICTORY_TEST':
            user_row = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
            uid = user_row['id']
            mysteries = conn.execute('SELECT id FROM mysteries WHERE is_active = 1').fetchall()
            for m in mysteries:
                conn.execute('INSERT OR IGNORE INTO mystery_progress (user_id, mystery_id, status, unlocked_at, completed_at) VALUES (?, ?, ?, ?, ?)',
                             (uid, m['id'], 'completed', last_login_str, last_login_str))

    conn.commit()
    conn.close()


if __name__ == '__main__':
    print('[BOOT] Initializing mystery data...')
    init_mysteries()
    print('[BOOT] Initializing test accounts...')
    setup_test_accounts()
    print('=' * 45)
    app.run(debug=True, port=5000)