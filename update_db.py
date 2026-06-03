import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'escape_realm.db')

def update_database():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("ALTER TABLE moods ADD COLUMN note TEXT")
        print("✅ 成功在 moods 資料表加入 'note' 欄位！")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("⚠️ 'note' 欄位已經存在，無需重複加入。")
        else:
            print(f"❌ 發生錯誤：{e}")
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    update_database()
