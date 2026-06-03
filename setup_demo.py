import sqlite3
import datetime
from werkzeug.security import generate_password_hash
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'escape_realm.db')

def setup_demo_user():
    conn = sqlite3.connect(DB_PATH)
    
    username = 'DEMO_AGENT'
    password = '123'
    hashed_pw = generate_password_hash(password)
    
    # 算出昨天的日期
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    
    # 檢查是否已經有這個帳號
    user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    
    if user:
        user_id = user[0]
        # 如果已經有，就強制重置為 6 天，並設為昨天登入
        conn.execute('''
            UPDATE users 
            SET password_hash = ?, streak_count = 6, last_login = ? 
            WHERE id = ?
        ''', (hashed_pw, yesterday.isoformat(), user_id))
        
        # 為了能重複展示「獲得徽章」的特效，把已經拿到的 7 天徽章刪除
        conn.execute('DELETE FROM user_badges WHERE user_id = ? AND badge_id = 1', (user_id,))
        
        # 為了保持報告大廳乾淨，清空之前測試產生的分析報告
        conn.execute('DELETE FROM reports WHERE user_id = ?', (user_id,))
        
        # 順便清除「今天」重複測試打卡的紀錄，避免日曆或地圖上出現重複資料
        today_str = datetime.date.today().isoformat()
        conn.execute('DELETE FROM moods WHERE user_id = ? AND date(created_at) = ?', (user_id, today_str))

        print(f"✅ 已成功重置展示帳號 '{username}' 的狀態。")
    else:
        # 如果沒有，就建立一個新的
        cursor = conn.execute('''
            INSERT INTO users (username, password_hash, streak_count, last_login) 
            VALUES (?, ?, 6, ?)
        ''', (username, hashed_pw, yesterday.isoformat()))
        user_id = cursor.lastrowid
        print(f"✅ 已成功建立全新的展示帳號 '{username}'。")
        
    conn.commit()
    conn.close()
    
    print("-" * 40)
    print(f"👉 測試專用帳號：{username}")
    print(f"👉 測試專用密碼：{password}")
    print(f"👉 目前帳號狀態：已連續簽到 6 天 (假裝昨天有登入)")
    print("-" * 40)
    print("準備就緒！")
    print("你現在可以去網頁上登入這個帳號，只要按任何一個心情按鈕，")
    print("就會立刻跳到 7 天，並同時觸發「徽章解鎖」與「平行世界異常」！")

if __name__ == '__main__':
    setup_demo_user()