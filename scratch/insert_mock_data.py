import sqlite3
import json
import uuid
import datetime
import os

DB_PATH = r"c:\Users\wajeepradit.p\git\profile_automate\data\jobs.db"

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(conn):
    cursor = conn.cursor()
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

def clear_db(conn):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM job_logs")
    cursor.execute("DELETE FROM jobs")
    conn.commit()

def insert_job(conn, job_id, status, current_step, payload, result=None, error=None, username=None, created_by="admin", minutes_ago=0):
    cursor = conn.cursor()
    now = datetime.datetime.utcnow()
    created_at = (now - datetime.timedelta(minutes=minutes_ago)).isoformat()
    updated_at = (now - datetime.timedelta(minutes=max(0, minutes_ago - 5))).isoformat()
    
    cursor.execute('''
        INSERT INTO jobs (id, status, current_step, payload, result, error, username, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        job_id,
        status,
        current_step,
        json.dumps(payload),
        json.dumps(result) if result else None,
        error,
        username,
        created_by,
        created_at,
        updated_at
    ))

def insert_log(conn, job_id, step, status, message, minutes_ago=0):
    cursor = conn.cursor()
    timestamp = (datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes_ago)).isoformat()
    cursor.execute('''
        INSERT INTO job_logs (job_id, step, status, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (job_id, step, status, message, timestamp))

def main():
    conn = get_db_connection()
    init_db(conn)
    clear_db(conn)
    
    # 1. Job: Success - Mr. Somchai Kornthong
    job_id_1 = "job-somchai-001"
    payload_1 = {
        "metadata": {
            "document_info": {"date": "07/06/26", "doc_no": "EF-26060001-A1"},
            "requester_info": {
                "name_english": "Mr. Somchai Kornthong",
                "company": "AHT",
                "employee_id": "10003082",
                "position": "Lead Developer",
                "department": "Engineering"
            }
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": True,
            "enable_microsoft_365_license": True,
            "enable_send_email": True,
            "high_priority": True
        }
    }
    insert_job(conn, job_id_1, "success", "send_email", payload_1, username="somchai.k", minutes_ago=60)
    insert_log(conn, job_id_1, "ad_creation", "success", "sAMAccountName 'somchai.k' created successfully under OU=Engineering", 59)
    insert_log(conn, job_id_1, "ad_creation", "success", "Added to group: User_LevelC_AH", 58)
    insert_log(conn, job_id_1, "papercut_sync", "success", "Handshake succeeded, card code linked", 57)
    insert_log(conn, job_id_1, "papercut_sync", "success", "Print PIN 112233 mapped on Papercut Database", 56)
    insert_log(conn, job_id_1, "m365_license", "success", "Microsoft 365 E3 license assigned successfully", 55)
    insert_log(conn, job_id_1, "send_email", "success", "Welcome Email sent to supervisor Anek Phromsiri (anek.p@aapico.com)", 54)

    # 2. Job: Failed - Ms. Wanida Srisai
    job_id_2 = "job-wanida-002"
    payload_2 = {
        "metadata": {
            "document_info": {"date": "07/06/26", "doc_no": "EF-26060002-A1"},
            "requester_info": {
                "name_english": "Ms. Wanida Srisai",
                "company": "AAPICO Amata",
                "employee_id": "10003083",
                "position": "HR Specialist",
                "department": "Human Resources"
            }
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": True,
            "enable_microsoft_365_license": True,
            "enable_send_email": True,
            "high_priority": False
        }
    }
    insert_job(conn, job_id_2, "failed", "m365_license", payload_2, username="wanida.s", error="M365 License assignment failed: Out of Stock", minutes_ago=45)
    insert_log(conn, job_id_2, "ad_creation", "success", "sAMAccountName 'wanida.s' created successfully under OU=Users", 44)
    insert_log(conn, job_id_2, "papercut_sync", "success", "Print PIN mapped on Papercut Database", 43)
    insert_log(conn, job_id_2, "m365_license", "running", "Attempting to assign license: SPE_E3 (Microsoft 365 E3)", 42)
    insert_log(conn, job_id_2, "m365_license", "failed", "Graph API Error: License sku SPE_E3 is out of stock", 41)

    # 3. Job: Processing (Running) - Mr. Kittisak Udorn
    job_id_3 = "job-kittisak-003"
    payload_3 = {
        "metadata": {
            "document_info": {"date": "07/06/26", "doc_no": "EF-26060003-A1"},
            "requester_info": {
                "name_english": "Mr. Kittisak Udorn",
                "company": "AAPICO Hitech",
                "employee_id": "10003084",
                "position": "IT Support Engineer",
                "department": "Information Technology"
            }
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": True,
            "enable_microsoft_365_license": True,
            "enable_send_email": True,
            "high_priority": True
        }
    }
    insert_job(conn, job_id_3, "processing", "m365_license", payload_3, username="kittisak.u", minutes_ago=3)
    insert_log(conn, job_id_3, "ad_creation", "success", "sAMAccountName 'kittisak.u' created successfully under OU=Users", 2)
    insert_log(conn, job_id_3, "papercut_sync", "success", "Print PIN set successfully", 1)
    insert_log(conn, job_id_3, "m365_license", "running", "Contacting Microsoft Graph API to assign SPE_E3 licenses...", 0)

    # 4. Job: Paused - Ms. Sunisa Jaiyen
    job_id_4 = "job-sunisa-004"
    payload_4 = {
        "metadata": {
            "document_info": {"date": "07/06/26", "doc_no": "EF-26060004-A1"},
            "requester_info": {
                "name_english": "Ms. Sunisa Jaiyen",
                "company": "AHT",
                "employee_id": "10003085",
                "position": "Accountant",
                "department": "Accounting"
            }
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": True,
            "enable_microsoft_365_license": False,
            "enable_send_email": True,
            "high_priority": False
        }
    }
    insert_job(conn, job_id_4, "paused", "papercut_sync", payload_4, username="sunisa.j", minutes_ago=15)
    insert_log(conn, job_id_4, "ad_creation", "success", "sAMAccountName 'sunisa.j' created successfully", 14)
    insert_log(conn, job_id_4, "papercut_sync", "paused", "งานถูกหยุดชั่วคราวโดยผู้ดูแลระบบ (Job paused by admin)", 13)

    # 5. Job: Queued - Mr. Anupong Rakdee
    job_id_5 = "job-anupong-005"
    payload_5 = {
        "metadata": {
            "document_info": {"date": "07/06/26", "doc_no": "EF-26060005-A1"},
            "requester_info": {
                "name_english": "Mr. Anupong Rakdee",
                "company": "AAPICO Amata",
                "employee_id": "10003086",
                "position": "Production Operator",
                "department": "Production"
            }
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": False,
            "enable_microsoft_365_license": False,
            "enable_send_email": False,
            "high_priority": False
        }
    }
    insert_job(conn, job_id_5, "queued", "ad_creation", payload_5, minutes_ago=2)
    insert_log(conn, job_id_5, "ad_creation", "running", "Job enqueued successfully", 2)

    conn.commit()
    conn.close()
    print("Mockup job queue data successfully inserted into jobs.db!")

if __name__ == "__main__":
    main()
