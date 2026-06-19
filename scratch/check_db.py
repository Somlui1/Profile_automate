import sqlite3
import os

db_path = "data/jobs.db"
print(f"Checking DB at: {os.path.abspath(db_path)}")
print(f"Exists: {os.path.exists(db_path)}")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("Tables:", tables)
    for table in tables:
        tname = table[0]
        cursor.execute(f"PRAGMA table_info({tname})")
        columns = cursor.fetchall()
        print(f"Columns for {tname}:", [col[1] for col in columns])
    conn.close()
