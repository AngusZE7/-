CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    streak_count INTEGER DEFAULT 0,
    last_login DATE,
    parallel_unlocked INTEGER DEFAULT 0,
    game_completed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    required_streak INTEGER NOT NULL
);

-- 初始化徽章數據
INSERT OR IGNORE INTO badges VALUES (1, '青澀探索者', '達成連續 7 天簽到', 7);
INSERT OR IGNORE INTO badges VALUES (2, '謎境追蹤者', '達成連續 15 天簽到', 15);
INSERT OR IGNORE INTO badges VALUES (3, '地圖掌控者', '達成連續 30 天簽到', 30);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id INTEGER,
    badge_id INTEGER,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, badge_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(badge_id) REFERENCES badges(id)
);

CREATE TABLE IF NOT EXISTS moods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    mood_type TEXT NOT NULL,
    emoji TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    location_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mysteries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    chapter INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    hint TEXT,
    reward TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mystery_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mystery_id INTEGER NOT NULL,
    status TEXT DEFAULT 'locked',
    unlocked_at TEXT,
    completed_at TEXT,
    UNIQUE(user_id, mystery_id)
);