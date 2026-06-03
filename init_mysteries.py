import sqlite3
from mysteries import MYSTERY_SEEDS

DB_NAME = "escape_realm.db"


def init_mysteries():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    for mystery in MYSTERY_SEEDS:
        cursor.execute(
            """
            INSERT OR IGNORE INTO mysteries
            (code, chapter, title, description, lat, lon, hint, reward)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mystery["code"],
                mystery["chapter"],
                mystery["title"],
                mystery["description"],
                mystery["lat"],
                mystery["lon"],
                mystery.get("hint"),
                mystery.get("reward")
            )
        )

    conn.commit()
    conn.close()    
    print("Mystery data initialized.")




init_mysteries()

