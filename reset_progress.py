import sqlite3

USERNAME = "TEST"

conn = sqlite3.connect("escape_realm.db")
cursor = conn.cursor()

cursor.execute("""
SELECT id
FROM users
WHERE username = ?
""", (USERNAME,))

row = cursor.fetchone()

if not row:
    print("找不到使用者")
    conn.close()
    exit()

user_id = row[0]

cursor.execute("""
DELETE FROM mystery_progress
WHERE user_id = ?
""", (user_id,))

conn.commit()
conn.close()

print(f"{USERNAME} 的劇情進度已重置")