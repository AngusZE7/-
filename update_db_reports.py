import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'escape_realm.db')

def update_database():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        ''')
        print("✅ 成功建立 reports 資料表！")
    except Exception as e:
        print(f"❌ 發生錯誤：{e}")
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    update_database()