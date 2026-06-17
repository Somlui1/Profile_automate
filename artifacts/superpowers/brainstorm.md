# Brainstorm: Worker Stability & Testing Workflow

## Goal

แก้ปัญหา 2 ข้อหลัก:
1. **Worker Stability** — `worker.ps1` เปิด PowerShell หน้าต่างใหม่ (`Start-Process`) ซึ่งทำให้ process ค้างและ cancel ไม่ได้ รวมถึง `SimpleWorker` บน Windows อาจ block event loop
2. **Testing UX** — ปัจจุบันต้องรัน 3 อย่างแยกกัน (dev.ps1 → mock_test → worker) ทำให้เสียเวลา kill/restart process บ่อย

---

## Constraints

- **Windows-only dev environment** (PowerShell, ไม่มี `fork()`)
- RQ `SimpleWorker` ต้องรันบน Windows (ไม่มี `Worker` แบบ multiprocess)
- ต้องรองรับทั้ง `SYSTEM_MODE=debug` (FAKE_REDIS) และ production (REDIS_URL)
- ไม่เปลี่ยน API contract หรือ worker logic หลัก
- Docker ยังคงเป็น production path (มี `docker-compose.yml`)

---

## Known Context

| ส่วน | สถานะปัจจุบัน | ปัญหา |
|------|--------------|-------|
| `worker.ps1` | `Start-Process powershell -NoExit ...` | เปิดหน้าต่างใหม่ ทำให้ Ctrl+C ใน parent ไม่ kill child |
| `worker/run.py` | `SimpleWorker(...).work(with_scheduler=True)` | `with_scheduler=True` อาจ block บน Windows เพราะ scheduler ใช้ thread pool |
| `dev.ps1` | `uvicorn ... --reload` เท่านั้น | ต้องรันแยก terminal |
| Mock test | `python temp/mock_test_sync_user.py api localhost:8000` | ต้อง start API ก่อน, แล้วค่อยรัน mock, แล้วค่อยรัน worker |
| Testing mode | มี 3 modes: local, api, virtual | virtual mode ยังต้องใช้ Redis จริง |

---

## Risks

| Risk | ระดับ | แนวทางป้องกัน |
|------|-------|--------------|
| `SimpleWorker` + `with_scheduler=True` อาจ deadlock บน Windows | 🔴 สูง | ปิด scheduler หรือทดสอบ graceful shutdown |
| `Start-Process` ทำให้ subprocess ไม่ถูก kill เมื่อ parent ตาย | 🔴 สูง | เปลี่ยนเป็น foreground process |
| การรวม processes ใน script เดียวทำให้ debug ยากขึ้น | 🟡 กลาง | ใช้ Job `Start-Job` พร้อม log แยก stream |
| `--reload` ใน uvicorn อาจ conflict กับ worker process | 🟡 กลาง | แยก log output ชัดเจน |

---

## Options

### Option A — `dev-all.ps1`: PowerShell Job-based orchestrator
รวมทุกอย่างใน script เดียว ใช้ `Start-Job` (background jobs ใน PowerShell) เพื่อรัน API + Worker พร้อมกัน แล้วรับ `Ctrl+C` เพื่อ kill ทั้งหมด

**ข้อดี**: ง่าย, ไม่ต้องติดตั้งเพิ่ม, cancel ได้จาก terminal เดิม
**ข้อเสีย**: log อาจปน, PowerShell Job stream มี latency

---

### Option B — Python `dev_runner.py`: Subprocess orchestrator
ใช้ Python `subprocess.Popen` รัน uvicorn + worker พร้อมกัน, จัดการ graceful shutdown ด้วย `signal.SIGINT`

**ข้อดี**: cross-platform, log prefix ชัด, graceful shutdown แน่นอน
**ข้อเสีย**: ต้องรัน python ก่อน (แต่มี venv อยู่แล้ว)

---

### Option C — `test.ps1`: One-shot test script
Script ที่รัน API → รอ health check → รัน mock test → kill API อัตโนมัติ

**ข้อดี**: เหมาะ CI/CD, ไม่ต้อง kill manual
**ข้อเสีย**: ไม่รัน worker จริง

---

### Option D — รวม B + C (Recommended)

---

## Recommendation

**ใช้ Option B (Python orchestrator) + Option C (test script)**

1. **สร้าง `dev_runner.py`** — Python subprocess orchestrator ที่:
   - รัน uvicorn + worker พร้อมกันใน foreground
   - Stream log พร้อม `[API]` / `[WORKER]` prefix
   - Graceful shutdown ด้วย `Ctrl+C`
   - รอ API healthy ก่อน print "Ready"

2. **แก้ `worker/run.py`** — ปิด `with_scheduler=True` → `with_scheduler=False` เพื่อป้องกัน Windows deadlock

3. **สร้าง `test.ps1`** — One-liner script สำหรับ test ทุก mode

4. **แก้ `worker.ps1`** — เปลี่ยนจาก `Start-Process` เป็น foreground

---

## Acceptance Criteria

| เกณฑ์ | วิธีตรวจสอบ |
|-------|------------|
| `Ctrl+C` ใน terminal หยุด worker และ API ได้ทันที | รัน `dev_runner.py`, กด Ctrl+C → process หายทั้งหมด |
| Log แยก prefix `[API]` / `[WORKER]` ชัดเจน | ดู output ใน terminal |
| รัน full test ด้วย command เดียว | `python dev_runner.py --test` หรือ `.\test.ps1` |
| Worker ไม่ค้างหลัง job เสร็จ | ส่ง job, รอ complete, worker ยังรับ job ต่อได้ |
| `with_scheduler` ไม่ block บน Windows | ไม่มี hang หลัง idle 30+ วินาที |
