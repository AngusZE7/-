import sqlite3
import datetime
from werkzeug.security import generate_password_hash
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'escape_realm.db')

def reset_test_account(username='BREAK_TEST', password='123', streak=2, days_ago=1):
    conn = sqlite3.connect(DB_PATH)
    hashed_pw = generate_password_hash(password)
    last_login = (datetime.date.today() - datetime.timedelta(days=days_ago)).isoformat()

    user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if user:
        user_id = user[0]
        conn.execute('UPDATE users SET password_hash=?, streak_count=?, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                     (hashed_pw, streak, last_login, user_id))
        conn.execute('DELETE FROM user_badges WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM moods WHERE user_id=? AND date(created_at) != ?', (user_id, last_login))
    else:
        conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked) VALUES (?, ?, ?, ?, 0)',
                     (username, hashed_pw, streak, last_login))

    conn.commit()
    conn.close()

    print(f"✅ 測試帳號已重置：{username} / {password}")
    print(f"   連續簽到：{streak} 天")
    print(f"   最後打卡：{days_ago} 天前 ({last_login})")
    print(f"   平行世界：尚未解鎖")

def reset_broken_streak_account(username='BROKEN_TEST', password='123'):
    conn = sqlite3.connect(DB_PATH)
    hashed_pw = generate_password_hash(password)
    three_days_ago = (datetime.date.today() - datetime.timedelta(days=3)).isoformat()

    user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if user:
        user_id = user[0]
        conn.execute('UPDATE users SET password_hash=?, streak_count=5, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                     (hashed_pw, three_days_ago, user_id))
        conn.execute('DELETE FROM user_badges WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user_id,))
    else:
        conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 5, ?, 0, 0)',
                     (username, hashed_pw, three_days_ago))

    conn.commit()
    conn.close()

    print(f"✅ 斷簽測試帳號已建立：{username} / {password}")
    print(f"   連續簽到：5 天（但已中斷 3 天）")
    print(f"   最後打卡：3 天前 ({three_days_ago})")
    print(f"   預期：登入後會彈出 STREAK_BROKEN 紅色警示")

def reset_seven_day_account(username='SEVEN_TEST', password='123'):
    conn = sqlite3.connect(DB_PATH)
    hashed_pw = generate_password_hash(password)
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    user = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if user:
        user_id = user[0]
        conn.execute('UPDATE users SET password_hash=?, streak_count=6, last_login=?, parallel_unlocked=0, game_completed=0 WHERE id=?',
                     (hashed_pw, yesterday, user_id))
        conn.execute('DELETE FROM user_badges WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM mystery_progress WHERE user_id=?', (user_id,))
        conn.execute('DELETE FROM moods WHERE user_id=?', (user_id,))
    else:
        conn.execute('INSERT INTO users (username, password_hash, streak_count, last_login, parallel_unlocked, game_completed) VALUES (?, ?, 6, ?, 0, 0)',
                     (username, hashed_pw, yesterday))

    conn.commit()
    conn.close()

    print(f"✅ 七天報告測試帳號已建立：{username} / {password}")
    print(f"   連續簽到：6 天（昨天打卡）")
    print(f"   預期：打卡一次變 streak=7，觸發情緒分析報告")


if __name__ == '__main__':
    print("=" * 45)
    print("  測試帳號初始化")
    print("=" * 45)
    print()
    reset_test_account()
    print()
    reset_broken_streak_account()
    print()
    reset_seven_day_account()
    print()
    print("=" * 45)
    print("  完成！可用帳號一覽：")
    print("=" * 45)
    print()
    print("  BREAK_TEST   / 123 → streak=2, 測平行世界解鎖")
    print("  BROKEN_TEST  / 123 → streak=0, 測中斷警示")
    print("  SEVEN_TEST   / 123 → streak=6, 測7天分析報告")
    print("  VICTORY_TEST / 123 → 全解完, 測慶祝畫面")
