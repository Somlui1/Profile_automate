import sqlite3
import os

def run_migration():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    db_path = os.path.join(project_root, "api", "data", "jobs.db")
    
    print(f"Connecting to database at: {db_path}")
    if not os.path.exists(db_path):
        print("Database file does not exist yet. No migration needed.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE job_logs ADD COLUMN metadata TEXT;")
        conn.commit()
        print("Migration successful: Added 'metadata' column to 'job_logs' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'metadata' already exists. Migration skipped.")
        else:
            print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
