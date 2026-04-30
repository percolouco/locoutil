import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.environ.get("DB_PATH", "/data/locoutil.db")

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    daily_price REAL NOT NULL DEFAULT 0,
    weekend_price REAL NOT NULL DEFAULT 0,
    deposit REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS tool_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    is_main INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS client_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    label TEXT DEFAULT 'Document'
);

CREATE TABLE IF NOT EXISTS platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL REFERENCES tools(id),
    client_id INTEGER NOT NULL REFERENCES clients(id),
    platform_id INTEGER REFERENCES platforms(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    deposit_collected INTEGER DEFAULT 0,
    deposit_returned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    return_notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO platforms (name) VALUES ('Direct');
INSERT OR IGNORE INTO platforms (name) VALUES ('Leboncoin');
"""

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
