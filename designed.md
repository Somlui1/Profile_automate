# Production Architecture: Docker + Job Broker + Worker + Real-time State

ปรับโครงสร้างโปรเจกต์ใหม่ทั้งหมด ให้แยก directory ชัดเจน และใช้ **Docker Compose** ในการรัน 3 services เบื้องหลัง: **API Server**, **Redis**, **RQ Worker** พร้อมระบบ **SSE** สำหรับ push สถานะแบบ realtime, รองรับ **Pause / Cancel** อย่างนุ่มนวล, และ **Debug Panel** บน frontend สำหรับตรวจสอบข้อมูลใน Redis

---

## User Review Required

> [!IMPORTANT]
> **Docker เป็นตัวหลักในการรัน**: ทุก service (API, Redis, Worker) จะรันผ่าน `docker compose up -d` คำสั่งเดียว

> [!IMPORTANT]
> **โครงสร้างเดิมจะถูกจัดระเบียบใหม่**: ไฟล์ทุกตัวจะถูกย้ายเข้าโฟลเดอร์ที่เหมาะสม แต่โค้ด service เดิม (`ad_service.py`, `papercut_service.py` ฯลฯ) จะถูก **คงเนื้อหาไว้เหมือนเดิม** ย้ายแค่ตำแหน่ง

> [!WARNING]
> **Debug Panel จะเปิดเฉพาะ Dev/Staging** — สามารถปิดได้ผ่าน `.env` ด้วย `DEBUG_MODE=false` เพื่อป้องกันการเข้าถึงข้อมูลภายในใน Production

## Open Questions

> [!IMPORTANT]
> **Rollback เมื่อ Cancel**: เมื่อ Cancel งานที่สร้าง AD Account ไปแล้ว ต้องการให้ลบ AD Account ออก (Rollback) หรือปล่อยค้าง? (ค่าเริ่มต้น: Rollback)

> [!IMPORTANT]
> **ระยะเวลาเก็บ Log**: เก็บ Job Log กี่วัน? (ค่าเริ่มต้น: 30 วัน)

---

## สถาปัตยกรรมใหม่

```text
┌────────────────┐              ┌─────────────────┐              ┌──────────────┐
│  Web Admin UI  ├──────────────►  FastAPI Backend ├──────────────►  Redis Queue │
│  (Frontend)    │  POST /sync  │   (Producer)     │  enqueue()   │  (Broker)    │
└──────▲─────────┘              └────────┬─────────┘              └──────┬───────┘
       │                                 │                               │
       │ SSE /jobs/{id}/stream           │ Read/Write                    │ Worker dequeue
       │                                 ▼                               ▼
       │                         ┌───────────────┐              ┌────────────────┐
       │                         │  SQLite DB    │◄─────────────┤  RQ Worker     │
       └─────────────────────────┤  (Job Logs)   │  Update      │  (Consumer)    │
                                 └───────────────┘  Status/Log  └────────┬───────┘
       ┌─────────────────┐                                               │
       │  Debug Panel    │──── GET /debug/* ──────────────►  Redis       │
       │  (Frontend UI)  │    inspect queue/jobs             Inspect     │
       └─────────────────┘                                          LDAP / XML-RPC
                                                                         ▼
                                                                 ┌───────────────┐
                                                                 │ AD & Papercut │
                                                                 └───────────────┘
```

> [!NOTE]
> **ระบบจำลอง Redis ในโหมดทดสอบ (Offline Mock Mode)**:
> หากไม่ได้สตาร์ตเซิร์ฟเวอร์ Redis ในขณะรันแบบ Local และเปิด `DEBUG_MODE=true` ระบบจะสลับมาใช้การจำลอง (Mockup) ผ่านไฟล์ [redis_mock.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/core/redis_mock.py) โดย API และ Worker จะแชร์สถานะการทำงานผ่านไฟล์ข้อมูลร่วม [redis_state.json](file:///c:/Users/wajeepradit.p/git/profile_automate/data/redis_state.json) ซึ่งดึงโครงสร้างเริ่มต้นมาจาก [mock.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/mock.txt) ของ Worker อัตโนมัติ ทำให้สามารถทดสอบโฟลว์งานผ่านหน้าเว็บและ Debug Panel ได้โดยสมบูรณ์โดยไม่ต้องติดตั้ง Redis จริง

---

## โครงสร้างโปรเจกต์ใหม่

```text
profile_automate/
│
├── docker-compose.yml            # 🐳 Orchestrate ทุก service (api + redis + worker)
├── .env                          # 🔐 Environment config ทั้งหมด (mount เข้า containers)
├── .gitignore
├── README.md
│
├── api/                          # ── FastAPI Application (Container: api) ──
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI entry point
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py             # Settings จาก .env
│   │   ├── database.py           # SQLite connection, schema, CRUD
│   │   ├── exceptions.py         # Application error classes
│   │   ├── redis_conn.py         # Redis connection builder (รองรับ Mock Fallback)
│   │   └── redis_mock.py         # 🧪 NEW: Emulated Redis, Queue, and Job for offline dev
│   ├── endpoints/
│   │   ├── __init__.py
│   │   ├── parse.py              # PDF parsing endpoints
│   │   ├── user.py               # Legacy sync endpoint (backward compat)
│   │   ├── m365.py               # M365 license endpoints
│   │   ├── jobs.py               # Job queue CRUD + SSE streaming
│   │   ├── debug.py              # Debug/inspection endpoints (ตรวจเช็ก Mock Redis ได้)
│   │   └── router.py
│   └── services/
│       ├── __init__.py
│       ├── ad_service.py         # Active Directory service
│       ├── papercut_service.py   # Papercut service
│       ├── pdf_service.py        # PDF extraction service
│       └── m365_service.py       # Microsoft Graph service
│
├── worker/                       # ── RQ Worker Process (Container: worker) ──
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── run.py                    # Worker entry point (รองรับ Mock SQLite Polling Loop)
│   ├── mock.txt                  # 🧪 NEW: โครงสร้างข้อมูลจำลอง Redis สำหรับทดสอบ Local
│   └── tasks/
│       ├── __init__.py
│       ├── pipeline.py           # Engine จัดการ step-by-step
│       └── sync_user.py          # Provisioning task + checkpoints
│
├── frontend/                     # ── Static Web Dashboard ──
│   ├── index.html                # Single-page dashboard (ยุบ Manual Create มารวมที่ Step 2)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js                # จัดการ UI Flow, Event Listener และการยื่นคำร้อง
│   │   └── debug.js              # Debug Panel controller สำหรับดูค่าใน Redis/Mockup
│   └── component/
│       └── mail_format.txt       # แม่แบบอีเมลแจ้งพนักงานใหม่
│
├── data/                         # ── Persistent volumes ──
│   ├── jobs.db                   # SQLite (auto-created)
│   └── redis_state.json          # 🧪 Shared state file ของระบบจำลอง MockRedis (auto-created)
│
└── docs/
    ├── map_field.md
    └── note.md
```

---

## Docker Compose Architecture

```yaml
# 4 services: redis + api + worker + (optional) redis-insight
services:
  redis:        # Job broker
  api:          # FastAPI server
  worker:       # RQ Worker
  redis-insight: # 🔍 Optional GUI สำหรับดู Redis data ผ่าน browser
```

### Service Details

#### 1. `redis` — Job Broker
- **Image**: `redis:7-alpine`
- **Port**: `6379:6379` (expose เฉพาะ dev เพื่อให้ debug tools เข้าถึง)
- **Persistent**: Docker volume `redis_data`

#### 2. `api` — FastAPI Server
- **Build**: `api/Dockerfile`
- **Port**: `8000:8000`
- **Volumes**: `./frontend:/app/frontend:ro`, `./data:/app/data`
- **Env**: `env_file: .env`

#### 3. `worker` — RQ Worker
- **Build**: `worker/Dockerfile`
- **Volumes**: `./data:/app/data`, `./api/services:/app/services:ro`
- **Env**: `env_file: .env`

#### 4. `redis-insight` — Redis GUI (Optional, Dev only)
- **Image**: `redis/redisinsight:latest`
- **Port**: `5540:5540`
- **Purpose**: เปิดเว็บ `http://localhost:5540` เพื่อ browse Redis keys, ดู queue contents, monitor แบบ visual

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Docker Network (internal)                     │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │  redis   │◄──┤   api    │   │  worker  │   │redis-insight │ │
│  │  :6379   │   │  :8000   │   │  (RQ)    │   │  :5540       │ │
│  └──────────┘   └────┬─────┘   └──────────┘   └──────────────┘ │
│                      │                                           │
└──────────────────────┼───────────────────────────────────────────┘
                       │ Port 8000           Port 5540 (optional)
                  ┌────▼─────┐          ┌────────────────┐
                  │ Browser  │          │ RedisInsight UI │
                  └──────────┘          └────────────────┘
```

---

## ✨ Debug & Redis Inspection (รายละเอียดใหม่)

### แนวคิด: ให้ทดสอบจาก Frontend ได้ + ตรวจข้อมูลใน Redis ได้ด้วย

### 🧪 Offline Mock Mode (การรันแบบจำลองโดยไม่ต้องมี Redis Server)

หากนักพัฒนารันแอปพลิเคชันโดยตรงบนเครื่องเครื่องแบบ Local (ไม่ผ่าน Docker) หรือในสภาพแวดล้อมที่ไม่มี Redis:
1. **Mock Fallback**: เมื่อสตาร์ต API Server และเปิดค่า `DEBUG_MODE=true` ในไฟล์ `.env` หากระบบเชื่อมต่อ Redis ไม่สำเร็จ จะสลับไปเปิดใช้งานคิวจำลองโดยอาศัยคลาส `MockRedis` และ `MockQueue` จากไฟล์ [redis_mock.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/core/redis_mock.py)
2. **Mock Database**: ระบบจะทำการสกัดค่าและคีย์เริ่มต้นของ Redis จากแม่แบบ [mock.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/mock.txt) และทำการเขียน/อ่านบันทึกสเตตลงในไฟล์กลางร่วมกันคือ [redis_state.json](file:///c:/Users/wajeepradit.p/git/profile_automate/data/redis_state.json)
3. **Mock Worker (SQLite Polling)**: ตัว Worker ([run.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/run.py)) จะเข้าสู่โหมด **SQLite Loop Polling** คอยดึงคำสั่งจัดทำบัญชีที่มีสถานะเป็น `"queued"` ในฐานข้อมูล SQLite นำมาผ่าน Pipeline จำลองทีละขั้นตอน และส่ง Log คืนให้หน้าจอดึงข้อมูลความคืบหน้าแบบ Realtime (SSE) เสมือนระบบรันจริงทุกประการ
4. **Debug Panel**: ผู้ใช้สามารถเปิด Debug Panel บนเบราว์เซอร์เพื่อทดสอบ **Flush Queue**, **Test Enqueue**, และ Browse รายการ **Redis Keys** ได้ตามปกติ ซึ่ง API จะตอบข้อมูลคีย์จำลองผ่าน mock engine ทั้งสิ้น

เมื่อแอดมินกด Create User ระบบจะแสดง **Debug Panel** ที่เปิด/ปิดได้ แสดงข้อมูลดังนี้:

```text
┌─────────────────────────────────────────────────────┐
│ 🔧 Debug Panel                              [ปิด] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📋 Queue Status                                    │
│  ┌─────────────┬───────┐                           │
│  │ Queued Jobs  │  3    │                           │
│  │ Active Jobs  │  1    │                           │
│  │ Failed Jobs  │  0    │                           │
│  │ Workers      │  1    │                           │
│  └─────────────┴───────┘                           │
│                                                     │
│  📦 Current Job Payload (ข้อมูลที่ส่งเข้า Redis)    │
│  ┌─────────────────────────────────────────────┐   │
│  │ {                                           │   │
│  │   "job_id": "a1b2c3d4-...",                 │   │
│  │   "status": "processing",                   │   │
│  │   "current_step": "ad_create",              │   │
│  │   "payload": {                              │   │
│  │     "username": "kroeksak.m",               │   │
│  │     "employee_id": "10003082",              │   │
│  │     "target_ou": "OU=newhire,...",          │   │
│  │     ...                                     │   │
│  │   },                                        │   │
│  │   "enqueued_at": "2026-06-05T09:30:00Z"     │   │
│  │ }                                           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📜 Step Logs (realtime)                            │
│  09:30:01  ad_check    ✅ User does not exist       │
│  09:30:02  ad_create   🔄 Creating in OU=newhire   │
│  09:30:05  ad_create   ✅ Account created           │
│  09:30:05  pc_sync     ⏳ Waiting...                │
│                                                     │
│  🗄️ Redis Keys (raw)                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ rq:queue:sync          → 2 pending jobs     │   │
│  │ rq:job:a1b2c3d4-...    → current job data   │   │
│  │ rq:workers             → 1 active worker    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [🔄 Refresh]  [📋 Copy Payload]  [🗑️ Flush Queue] │
└─────────────────────────────────────────────────────┘
```

---

### Debug API Endpoints

#### [NEW] api/endpoints/debug.py

เปิดใช้งานเฉพาะเมื่อ `DEBUG_MODE=true` ใน `.env` — ถ้า `false` ทุก endpoint จะ return `403 Forbidden`

| Method | Path | Description |
|---|---|---|
| `GET` | `/debug/queue/status` | สรุปจำนวน jobs ในคิว (queued, active, failed, workers) |
| `GET` | `/debug/queue/jobs` | รายการ jobs ทั้งหมดในคิว Redis พร้อม payload |
| `GET` | `/debug/queue/jobs/{job_id}` | ข้อมูล raw ของ job ใน Redis (รวม enqueued_at, origin, meta) |
| `GET` | `/debug/redis/keys` | แสดง Redis keys ทั้งหมดที่เกี่ยวข้อง (rq:*) พร้อม type & TTL |
| `GET` | `/debug/redis/key/{key_name}` | ดึง value ของ key เฉพาะตัว (string/hash/list) |
| `GET` | `/debug/workers` | รายชื่อ workers ที่ online + งานที่กำลังทำ |
| `DELETE` | `/debug/queue/flush` | ล้าง queue ทั้งหมด (ล้างเฉพาะ pending, ไม่กระทบ active) |
| `POST` | `/debug/queue/test-enqueue` | สร้าง test job ด้วย mock payload สำหรับทดสอบ flow |

#### ตัวอย่าง Response: `GET /debug/queue/status`
```json
{
  "queue_name": "sync",
  "queued": 3,
  "started": 1,
  "failed": 0,
  "deferred": 0,
  "workers": [
    {
      "name": "worker-1.a3f2b1",
      "state": "busy",
      "current_job": "a1b2c3d4-...",
      "birth_date": "2026-06-05T09:00:00Z"
    }
  ]
}
```

#### ตัวอย่าง Response: `GET /debug/queue/jobs/{job_id}`
```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "started",
  "origin": "sync",
  "enqueued_at": "2026-06-05T09:30:00.123456Z",
  "started_at": "2026-06-05T09:30:00.456789Z",
  "ended_at": null,
  "func_name": "tasks.sync_user.sync_user_task",
  "args": ["a1b2c3d4-..."],
  "meta": {
    "current_step": "ad_create",
    "username": "kroeksak.m"
  },
  "timeout": 600,
  "ttl": null,
  "result": null,
  "exc_info": null
}
```

#### ตัวอย่าง Response: `GET /debug/redis/keys`
```json
{
  "total_keys": 8,
  "keys": [
    { "key": "rq:queue:sync", "type": "list", "length": 2, "ttl": -1 },
    { "key": "rq:job:a1b2c3d4-...", "type": "hash", "ttl": 604800 },
    { "key": "rq:job:e5f6a7b8-...", "type": "hash", "ttl": 604800 },
    { "key": "rq:workers", "type": "set", "members": 1, "ttl": -1 },
    { "key": "rq:worker:worker-1.a3f2b1", "type": "hash", "ttl": -1 }
  ]
}
```

---

### Frontend Debug Panel

#### [NEW] frontend/js/debug.js

JavaScript module สำหรับ Debug Panel:

```javascript
class DebugPanel {
    constructor() {
        this.panel = document.getElementById("debugPanel");
        this.isOpen = false;
        this.refreshInterval = null;
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.classList.toggle("hidden");
        if (this.isOpen) {
            this.startAutoRefresh();  // auto-refresh ทุก 2 วินาที
        } else {
            this.stopAutoRefresh();
        }
    }

    async fetchQueueStatus() { /* GET /debug/queue/status */ }
    async fetchCurrentJobPayload(jobId) { /* GET /debug/queue/jobs/{jobId} */ }
    async fetchRedisKeys() { /* GET /debug/redis/keys */ }
    async fetchJobLogs(jobId) { /* GET /jobs/{jobId}/logs */ }
    async flushQueue() { /* DELETE /debug/queue/flush */ }
    async testEnqueue() { /* POST /debug/queue/test-enqueue */ }
    copyPayload() { /* copy JSON to clipboard */ }

    renderQueueStatus(data) { /* render ตาราง queue summary */ }
    renderPayload(data) { /* render JSON viewer พร้อม syntax highlight */ }
    renderStepLogs(logs) { /* render log list พร้อม icon ✅🔄⏳❌ */ }
    renderRedisKeys(data) { /* render key list พร้อม type badge */ }
}
```

#### [MODIFY] frontend/index.html

เพิ่ม Debug Panel section (collapsible, ด้านล่างสุดของหน้า):
- ปุ่ม toggle 🔧 ที่มุมขวาล่าง (floating button)
- Panel แบ่ง 4 แท็บ: **Queue Status** | **Job Payload** | **Step Logs** | **Redis Keys**
- ปุ่ม action: **Refresh**, **Copy Payload**, **Flush Queue**, **Test Enqueue**
- แสดงเฉพาะเมื่อ API ตอบ `DEBUG_MODE=true` (ตรวจจาก endpoint `/debug/queue/status` — ถ้า 403 จะซ่อน Debug button)

---

## Proposed Changes (สรุปทุกไฟล์)

### Component 1: Docker Infrastructure

#### [NEW] docker-compose.yml

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"         # expose สำหรับ dev tools
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 3

  api:
    build: ./api
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./frontend:/app/frontend:ro
      - ./data:/app/data
    depends_on:
      redis:
        condition: service_healthy

  worker:
    build: ./worker
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./api/services:/app/services:ro
    depends_on:
      redis:
        condition: service_healthy

  # Optional: Redis GUI browser (เปิดที่ http://localhost:5540)
  redis-insight:
    image: redis/redisinsight:latest
    ports:
      - "5540:5540"
    depends_on:
      - redis
    profiles:
      - debug                # รันเฉพาะเมื่อ: docker compose --profile debug up

volumes:
  redis_data:
```

> `redis-insight` ใช้ `profiles: [debug]` — จะไม่ถูกรันปกติ ต้องสั่ง `docker compose --profile debug up -d` ถึงจะเปิดมาด้วย

#### [NEW] api/Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### [NEW] worker/Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "run.py"]
```

---

### Component 2: API Application

#### [MOVE+MODIFY] api/main.py
- ย้ายจาก `backend/app/main.py`
- ปรับ imports → `from endpoints.router`, `from core.config`
- เพิ่ม `startup`: `init_db()`
- Frontend path → `/app/frontend` (Docker mount)

#### [MOVE+MODIFY] api/core/config.py
- ย้ายจาก `backend/app/core/config.py`
- เพิ่ม settings:
  ```python
  REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
  DB_PATH: str = os.getenv("DB_PATH", "/app/data/jobs.db")
  JOB_LOG_RETENTION_DAYS: int = int(os.getenv("JOB_LOG_RETENTION_DAYS", "30"))
  JOB_CANCEL_ROLLBACK_AD: bool = os.getenv("JOB_CANCEL_ROLLBACK_AD", "true").lower() == "true"
  DEBUG_MODE: bool = os.getenv("DEBUG_MODE", "true").lower() == "true"
  ```

#### [MOVE] api/core/exceptions.py — ไม่แก้เนื้อหา

#### [NEW] api/core/database.py — SQLite schema + CRUD

#### [NEW] api/core/redis_conn.py — Redis connection + RQ Queue

#### [MOVE+MODIFY] api/services/*.py (4 files) — ปรับ import paths เท่านั้น

#### [MOVE+MODIFY] api/endpoints/parse.py, user.py, m365.py — ปรับ import paths เท่านั้น

#### [NEW] api/endpoints/jobs.py — Job CRUD + SSE streaming

#### [NEW] api/endpoints/debug.py — Debug/inspection endpoints (Redis + Queue)

#### [MODIFY] api/endpoints/router.py
```python
from endpoints import jobs, debug
api_router.include_router(jobs.router, prefix="/jobs", tags=["Job Queue Management"])
api_router.include_router(debug.router, prefix="/debug", tags=["Debug & Inspection"])
```

#### [NEW] api/requirements.txt
```text
fastapi==0.110.0
uvicorn==0.28.0
python-multipart==0.0.9
pypdf==6.6.0
python-dotenv==1.2.1
ldap3==2.9.1
requests==2.32.5
redis>=5.0.0
rq>=1.16.0
sse-starlette>=2.0.0
```

---

### Component 3: Worker

#### [NEW] worker/run.py — RQ Worker entry point
#### [NEW] worker/tasks/sync_user.py — Step-by-step task + checkpoints
#### [NEW] worker/requirements.txt

---

### Component 4: Frontend

#### [MODIFY] frontend/js/app.js
- เปลี่ยน sync call เป็น async job + SSE
- เพิ่มปุ่ม Pause / Cancel / Resume

#### [NEW] frontend/js/debug.js
- Debug Panel controller (auto-refresh, Redis key viewer, payload inspector)

#### [MODIFY] frontend/index.html
- เพิ่ม Debug Panel section (collapsible)
- เพิ่ม floating debug button 🔧

---

### Component 5: Config & Docs

#### [MODIFY] .env
```env
# Redis
REDIS_URL=redis://redis:6379/0

# Job Worker
JOB_LOG_RETENTION_DAYS=30
JOB_CANCEL_ROLLBACK_AD=true
DB_PATH=/app/data/jobs.db

# Debug (ตั้ง false สำหรับ production)
DEBUG_MODE=true
```

#### [MODIFY] .gitignore — เพิ่ม `data/`, `*.db`
#### [MODIFY] README.md — โครงสร้างใหม่ + Docker commands
#### [MOVE] docs/map_field.md, docs/note.md — ย้ายจาก `temp/`
#### [DELETE] backend/, temp/

---

## สรุปไฟล์ทั้งหมด

| Action | Path | Purpose |
|---|---|---|
| **NEW** | `docker-compose.yml` | Orchestrate 4 services |
| **NEW** | `api/Dockerfile` | API container |
| **NEW** | `api/core/database.py` | SQLite CRUD |
| **NEW** | `api/core/redis_conn.py` | Redis + RQ Queue connection (พร้อม Mock Fallback) |
| **NEW** | `api/core/redis_mock.py` | 🧪 คลาสจำลอง Redis/Queue/Job สำหรับทดสอบแบบ Offline |
| **NEW** | `api/endpoints/jobs.py` | Job API + SSE |
| **NEW** | `api/endpoints/debug.py` | 🔍 Debug endpoints (รองรับการดูค่า Mock Redis) |
| **NEW** | `worker/Dockerfile` | Worker container |
| **NEW** | `worker/run.py` | Worker entry point (พร้อมลูป Polling จำลอง) |
| **NEW** | `worker/mock.txt` | 🧪 เทมเพลตข้อมูลคีย์ Redis เริ่มต้นเพื่อจัดทำ Mockup |
| **NEW** | `worker/tasks/sync_user.py` | Task + checkpoints |
| **NEW** | `worker/requirements.txt` | Worker deps |
| **NEW** | `frontend/js/debug.js` | 🔍 Debug Panel JS |
| **NEW** | `data/` (dir) | SQLite volume |
| **NEW** | `docs/` (dir) | Documentation |
| **MOVE+MODIFY** | `api/main.py` | ← `backend/app/main.py` |
| **MOVE+MODIFY** | `api/core/config.py` | ← + Redis/DB/Debug settings |
| **MOVE** | `api/core/exceptions.py` | ← เนื้อหาเดิม |
| **MOVE+MODIFY** | `api/services/*.py` (4) | ← fix imports only |
| **MOVE+MODIFY** | `api/endpoints/*.py` (4) | ← fix imports only |
| **MOVE** | `api/requirements.txt` | ← + new deps |
| **MODIFY** | `.env` | เพิ่ม Redis, DB, Debug config |
| **MODIFY** | `.gitignore` | เพิ่ม `data/`, `*.db` |
| **MODIFY** | `README.md` | โครงสร้างใหม่ + Docker |
| **MODIFY** | `frontend/js/app.js` | Async job + SSE + Pause/Cancel |
| **MODIFY** | `frontend/index.html` | รวม Manual Form ไว้ที่หน้า PDF Step 2 และถอด sidebar เก่าออก |
| **DELETE** | `backend/` | แทนที่ด้วย `api/` |

---

## การใช้งาน

### Quick Start (Docker)
```bash
# Start ทุกอย่าง (API + Redis + Worker)
docker compose up -d --build

# Start พร้อม RedisInsight GUI
docker compose --profile debug up -d --build

# ดู logs
docker compose logs -f
docker compose logs -f worker

# หยุด
docker compose down
```

### เข้าถึง
| URL | Service |
|---|---|
| `http://localhost:8000` | Admin Dashboard (Frontend) |
| `http://localhost:8000/docs` | Swagger API Docs |
| `http://localhost:5540` | RedisInsight GUI (ต้องเปิด debug profile) |

### ทดสอบ Debug Panel
1. เปิด `http://localhost:8000`
2. กดปุ่ม 🔧 ที่มุมขวาล่างเพื่อเปิด Debug Panel
3. กด **Test Enqueue** เพื่อสร้าง mock job → ดู payload ที่ถูกส่งเข้า Redis
4. สังเกต Queue Status อัปเดต (queued → started → ...)
5. กดแท็บ **Redis Keys** เพื่อดู raw keys ใน Redis
6. กด **Flush Queue** เพื่อล้าง pending jobs ทั้งหมด

---

## Verification Plan

### Automated Tests
```bash
# 1. Docker builds + starts
docker compose --profile debug up -d --build
docker compose ps

# 2. API healthy
curl http://localhost:8000/docs

# 3. Debug endpoints work
curl http://localhost:8000/api/v1/debug/queue/status
curl http://localhost:8000/api/v1/debug/redis/keys

# 4. Test enqueue
curl -X POST http://localhost:8000/api/v1/debug/queue/test-enqueue
# → ได้ job_id กลับมา

# 5. ตรวจ job payload ใน Redis
curl http://localhost:8000/api/v1/debug/queue/jobs/{job_id}
# → เห็น raw payload, func_name, meta, timestamps

# 6. ตรวจ job status + logs
curl http://localhost:8000/api/v1/jobs/{job_id}
curl http://localhost:8000/api/v1/jobs/{job_id}/logs

# 7. ทดสอบ cancel
curl -X PATCH http://localhost:8000/api/v1/jobs/{job_id} \
  -H "Content-Type: application/json" -d '{"action":"cancel"}'
```

### Manual Verification
- เปิด Admin UI → อัปโหลด PDF → กด Create → เปิด Debug Panel
- ดู **Job Payload** แสดงข้อมูลที่ส่งเข้า Redis ถูกต้อง
- ดู **Step Logs** อัปเดต realtime ตาม SSE
- ดู **Queue Status** เปลี่ยนจาก queued → started → 0
- ดู **Redis Keys** แสดง `rq:job:xxx` key ที่ถูกสร้าง
- กด Pause → ดู timeline หยุด + Debug Panel แสดง status = paused
- กด Cancel → ดู timeline แสดง cancelled + log rollback
- เปิด RedisInsight (`http://localhost:5540`) → browse keys → เปรียบเทียบกับ Debug Panel
