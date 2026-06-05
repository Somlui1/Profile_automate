import sqlite3
import json
import uuid
import datetime
import os
from typing import Dict, Any, List, Optional
from core.config import settings

def get_db_connection():
    # Ensure data directory exists
    os.makedirs(os.path.dirname(settings.DB_PATH), exist_ok=True)
    conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create jobs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            current_step TEXT,
            payload TEXT,
            result TEXT,
            error TEXT,
            username TEXT,
            created_by TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )
    ''')
    
    # Create job_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS job_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            step TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT,
            timestamp DATETIME,
            FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

def create_job(payload: Dict[str, Any], created_by: str = "admin") -> str:
    job_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO jobs (id, status, current_step, payload, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (job_id, 'queued', 'pending', json.dumps(payload), created_by, now, now))
    
    conn.commit()
    conn.close()
    return job_id

def update_job(job_id: str, status: str = None, current_step: str = None, result: Dict[str, Any] = None, error: str = None, username: str = None):
    now = datetime.datetime.utcnow().isoformat()
    updates = []
    params = []
    
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if current_step is not None:
        updates.append("current_step = ?")
        params.append(current_step)
    if result is not None:
        updates.append("result = ?")
        params.append(json.dumps(result))
    if error is not None:
        updates.append("error = ?")
        params.append(error)
    if username is not None:
        updates.append("username = ?")
        params.append(username)
        
    updates.append("updated_at = ?")
    params.append(now)
    
    params.append(job_id)
    
    query = f"UPDATE jobs SET {', '.join(updates)} WHERE id = ?"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()
    conn.close()

def add_log(job_id: str, step: str, status: str, message: str = ""):
    now = datetime.datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO job_logs (job_id, step, status, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (job_id, step, status, message, now))
    
    # Also update the job's updated_at timestamp to trigger SSE
    cursor.execute('UPDATE jobs SET updated_at = ? WHERE id = ?', (now, job_id))
    
    conn.commit()
    conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM jobs WHERE id = ?', (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        job = dict(row)
        if job['payload']: job['payload'] = json.loads(job['payload'])
        if job['result']: job['result'] = json.loads(job['result'])
        return job
    return None

def get_logs(job_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM job_logs WHERE job_id = ? ORDER BY id ASC', (job_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def list_jobs(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?', (limit, offset))
    rows = cursor.fetchall()
    conn.close()
    
    jobs = []
    for row in rows:
        job = dict(row)
        if job['payload']: job['payload'] = json.loads(job['payload'])
        if job['result']: job['result'] = json.loads(job['result'])
        jobs.append(job)
    return jobs

def cleanup_old_jobs(days: int = 30):
    cutoff = (datetime.datetime.utcnow() - datetime.timedelta(days=days)).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM jobs WHERE created_at < ?', (cutoff,))
    conn.commit()
    conn.close()
