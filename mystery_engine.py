import sqlite3
from datetime import datetime
from mysteries import STORY_CHAPTERS

DB_NAME = "escape_realm.db"


def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def get_all_mysteries(user_id=None, all_chapters=False):
    conn = get_db()
    cursor = conn.cursor()
    current_chapter = get_current_chapter(user_id)
    if all_chapters:
        cursor.execute("""
        SELECT *
        FROM mysteries
        WHERE chapter <= ?
        AND is_active = 1
        """, (current_chapter,))
    else:
        cursor.execute("""
        SELECT *
        FROM mysteries
        WHERE chapter = ?
        AND is_active = 1
        """, (current_chapter,))

    rows = cursor.fetchall()
    mysteries = [dict(row) for row in rows]
    # mysteries = [dict(row) for row in cursor.fetchall()]
    if user_id is not None:
        cursor.execute(
            """
            SELECT mystery_id, status, completed_at
            FROM mystery_progress
            WHERE user_id = ?
            """,
            (user_id,)
        )
        progress_rows = cursor.fetchall()
        progress_map = {
            row["mystery_id"]: {
                "status": row["status"],
                "completed_at": row["completed_at"]
            }
            for row in progress_rows
        }
        for mystery in mysteries:
            progress = progress_map.get(mystery["id"])
            if progress:
                mystery["status"] = progress["status"]
                mystery["completed_at"] = progress["completed_at"]
            else:
                mystery["status"] = "unlocked"
                mystery["completed_at"] = None
    conn.close()
    return mysteries


def unlock_mystery(user_id, mystery_id):
    conn = get_db()
    cursor = conn.cursor()

    now = datetime.now().isoformat(timespec="seconds")

    cursor.execute(
        """
        INSERT OR IGNORE INTO mystery_progress
        (user_id, mystery_id, status, unlocked_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, mystery_id, "unlocked", now)
    )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Mystery unlocked."
    }


def complete_mystery(user_id, mystery_id):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat(timespec="seconds")
    cursor.execute(
        """
        INSERT OR IGNORE INTO mystery_progress
        (user_id, mystery_id, status, unlocked_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, mystery_id, "unlocked", now)
    )
    cursor.execute(
        """
        UPDATE mystery_progress
        SET status = ?, completed_at = ?
        WHERE user_id = ? AND mystery_id = ?
        """,
        ("completed", now, user_id, mystery_id)
    )
    conn.commit()

    # 檢查是否所有謎團都已解完
    cursor.execute("""
        SELECT COUNT(*) FROM mysteries WHERE is_active = 1
    """)
    total = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(*) FROM mystery_progress
        WHERE user_id = ? AND status = 'completed'
    """, (user_id,))
    completed = cursor.fetchone()[0]

    game_completed = False
    if completed >= total:
        cursor.execute("UPDATE users SET game_completed = 1 WHERE id = ?", (user_id,))
        conn.commit()
        game_completed = True

    conn.close()
    return {
        "success": True,
        "message": "Mystery completed.",
        "game_completed": game_completed
    }

def get_current_chapter(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*)
        FROM mystery_progress
        WHERE user_id = ?
        AND status = 'completed'
    """,(user_id,))
    completed = cursor.fetchone()[0]
    conn.close()
    if completed >= 9:
        return 3
    elif completed >= 6:
        return 3
    elif completed >= 3:
        return 2
    return 1

def get_story_chapter(chapter_id):
    for chapter in STORY_CHAPTERS:
        if chapter["id"] == chapter_id:
            return chapter
    return None

def get_completed_chapters(user_id):
    conn = get_db()
    cursor = conn.cursor()
    completed_chapters = []
    cursor.execute("""
        SELECT DISTINCT chapter
        FROM mysteries
        WHERE is_active = 1
        ORDER BY chapter
    """)
    chapters = cursor.fetchall()
    
    for row in chapters:
        chapter = row["chapter"] if isinstance(row, dict) else row[0]

        # 該章節總任務數
        cursor.execute("""
            SELECT COUNT(*)
            FROM mysteries
            WHERE chapter = ?
            AND is_active = 1
        """, (chapter,))
        total_count = cursor.fetchone()[0]

        # 使用者完成數
        cursor.execute("""
            SELECT COUNT(*)
            FROM mystery_progress mp
            JOIN mysteries m
            ON mp.mystery_id = m.id
            WHERE mp.user_id = ?
            AND mp.status = 'completed'
            AND m.chapter = ?
            AND m.is_active = 1
        """, (user_id, chapter))
        completed_count = cursor.fetchone()[0]
        if completed_count >= total_count:
            completed_chapters.append(chapter)
    conn.close()
    return completed_chapters