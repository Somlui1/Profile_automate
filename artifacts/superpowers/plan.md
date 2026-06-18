# Plan: Graph API Pre-check + Preflight Health Check + M365 License Reliability

## Goal

เพิ่ม **Graph API Pre-check** (Option 2 จาก brainstorm) เข้าสู่ M365 license step — เรียก `GET /users/{upn}` ก่อน assign เพื่อยืนยันว่า user sync ขึ้น Azure AD แล้ว ถ้ายังไม่มี → re-enqueue ด้วย exponential backoff  
เพิ่ม **Preflight Health Check** ตรวจ AD/M365/PaperCut connectivity ก่อนเริ่ม pipeline — cancel job ทันทีหาก service ไม่พร้อม  
แก้ **SKU format bug** ที่ส่ง string แทน dict ไป Graph API

## Assumptions

1. Credential (Client ID/Secret) สำหรับ MS Graph ถูกต้อง — ปัญหาอยู่ที่ timing ไม่ใช่ auth
2. Azure AD Connect sync interval ~5 นาที แต่ไม่ deterministic
3. `M365_DELAY_SECONDS=300` (initial delay) คงเดิม — retry หลังจากนั้น
4. Mock mode ต้องทำงานได้ตามปกติ (health check pass เสมอใน mock)
5. ไม่เปลี่ยนโครงสร้าง pipeline (`_run_step`, `move_to_next_step`) — เพิ่ม logic เข้าไปเฉพาะจุดที่จำเป็น
6. Max retry สำหรับ M365 = 6 ครั้ง (~30 นาที max wait หลัง initial 5m delay)

---

## Plan

### Step 1: เพิ่ม Custom Exceptions (2 นาที)

**Files:** `worker/core/exceptions.py`

**Change:** เพิ่ม 2 exception classes ใหม่:
- `PreflightError` — ใช้เมื่อ health check ล้มเหลว
- `M365UserNotSyncedError` — ใช้เมื่อ user ยังไม่ sync ขึ้น Azure AD

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "from core.exceptions import PreflightError, M365UserNotSyncedError; print('OK')"
```

---

### Step 2: เพิ่ม `check_user_exists()`, `set_usage_location()` และ `resolve_sku_ids()` ใน m365_service (5 นาที)

**Files:** `worker/services/m365_service.py`

**Change:**
1. เพิ่ม method `check_user_exists(upn)` — เรียก `GET /v1.0/users/{upn}` ผ่าน Graph API
   - return `True` ถ้า status 200
   - return `False` ถ้า HTTP 404 (user ไม่มี)
   - raise Exception ถ้า error อื่น (เช่น 401, 500)
   - Mock mode: return `True` เสมอ
2. เพิ่ม method `set_usage_location(upn, usage_location)` — เรียก `PATCH /v1.0/users/{upn}` ผ่าน Graph API เพื่อตั้งค่า `usageLocation` (เป็น "TH") ก่อนการ assign licenses
   - ส่ง body เป็น `{"usageLocation": usage_location}`
   - Mock mode: print log และ return `True`
3. เพิ่ม method `resolve_sku_ids(sku_names)` — เรียก `GET /v1.0/subscribedSkus` แล้ว map `skuPartNumber` → `skuId`
   - Input: `["STANDARDPACK", "EMS"]` (strings)
   - Output: `[{"skuId": "guid-...", "skuPartNumber": "STANDARDPACK"}, ...]`
   - Mock mode: return input แปลงเป็น dict format พร้อม mock GUID

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "from services.m365_service import m365_service; print(m365_service.check_user_exists('test@aapico.com'))"
python -c "from services.m365_service import m365_service; print(m365_service.set_usage_location('test@aapico.com', 'TH'))"
python -c "from services.m365_service import m365_service; print(m365_service.resolve_sku_ids(['STANDARDPACK']))"
```

---

### Step 3: สร้าง Health Check Service (5 นาที)

**Files:** `worker/services/health_check.py` (NEW)

**Change:** สร้าง class `ServiceHealthChecker` พร้อม methods:
- `check_ad()` → `(bool, str)`: ลอง `ad_service._get_connection()` แล้ว unbind ทันที
- `check_m365()` → `(bool, str)`: ลอง `m365_service._get_access_token()`
- `check_papercut()` → `(bool, str)`: ลอง `papercut_service._server.api.getTotalUsers(auth_token)`
- `run_preflight(workflow_control)` → `(bool, list)`: ตรวจเฉพาะ service ที่ enabled
  - AD → check เสมอ (เป็น core dependency)
  - PaperCut → check ถ้า `enable_papercut_sync=True`
  - M365 → check ถ้า `enable_microsoft_365_license=True`
  - Mock mode: ทุก check return `(True, "Mock mode — skipped")`

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "from services.health_check import health_checker; ok, results = health_checker.run_preflight({}); print(ok, results)"
```

---

### Step 4: เพิ่ม Preflight Gate ใน `run_sync_pipeline()` (5 นาที)

**Files:** `worker/tasks/sync_user.py`

**Change:** เพิ่มโค้ดก่อนบรรทัด `# Find and enqueue the first enabled step` ในฟังก์ชัน `run_sync_pipeline()`:
1. Import `health_checker`
2. เรียก `health_checker.run_preflight(workflow)`
3. Log ผลลัพธ์แต่ละ service ด้วย `add_log(job_id, "preflight", ...)`
4. ถ้า fail → `update_job(status="cancelled")` + return ทันที (ไม่เริ่ม pipeline)
5. ถ้า pass → `add_log(job_id, "preflight", "success", "All services ready")` แล้วดำเนินต่อ

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "
from core.database import init_db, get_logs, create_job
from tasks.sync_user import run_sync_pipeline
init_db()
jid = create_job({})
run_sync_pipeline(jid, {})
logs = get_logs(jid)
steps = [l['step'] for l in logs]
assert 'preflight' in steps, f'preflight not found in {steps}'
print('Preflight gate OK:', steps)
"
```

---

### Step 5: เพิ่ม M365 User Pre-check + Retry ใน `_execute_m365_license()` (8 นาที)

**Files:** `worker/tasks/sync_user.py`

**Change:** ปรับ `_execute_m365_license()` (L316-333) ให้:
1. อ่าน `retry_count` จาก `payload.get("_m365_retry_count", 0)`, ตั้ง `MAX_RETRIES = 6`
2. เรียก `m365_service.check_user_exists(upn)` ก่อน assign
3. ถ้า user ไม่มี:
   - ถ้า `retry_count >= MAX_RETRIES` → raise Exception พร้อมข้อความ actionable
   - ถ้ายังไม่ถึง max → เพิ่ม `payload["_m365_retry_count"]`, คำนวณ delay `60 * 2^retry_count` วินาที, `add_log` แจ้งสถานะ, เรียก `sync_queue.enqueue_in(delay, ...)` แล้ว **raise `M365UserNotSyncedError`** เพื่อบอก `_run_step` ว่าไม่ต้อง `move_to_next_step`
4. ถ้า user มี → ดำเนินต่อ assign license ตามปกติ:
   - เพิ่มคำสั่ง `add_log(job_id, "m365_license", "running", f"Setting usageLocation to 'TH' for user {upn}")` ก่อนเรียก `m365_service.set_usage_location(upn, "TH")` เพื่อให้บันทึก log สอดคล้องกับ `sequence.md`

ปรับ `_run_step()` (L85-96) ให้:
- catch `M365UserNotSyncedError` แยกจาก Exception อื่น → ไม่ fail job, ไม่ move to next (เพราะ re-enqueue แล้ว)

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "
from core.database import init_db, get_logs, create_job
init_db()
# ทดสอบ mock mode: check_user_exists return True → assign สำเร็จทันที
from services.m365_service import m365_service
print('check_user_exists (mock):', m365_service.check_user_exists('test@aapico.com'))
print('Test OK')
"
```

---

### Step 6: แก้ SKU Format Bug ใน `normalize_payload()` (3 นาที)

**Files:** `worker/tasks/sync_user.py`

**Change:** ปรับ `normalize_payload()` L117-122 ที่สร้าง `licenses` list:
- เปลี่ยนจาก: `licenses = ["sku-ems", "sku-standardpack"]`
- เป็น: `licenses = [{"skuPartNumber": "EMS"}, {"skuPartNumber": "STANDARDPACK"}]`
- เพิ่มใน `_execute_m365_license()`: เรียก `m365_service.resolve_sku_ids(sku_ids)` เพื่อ resolve part names เป็น GUIDs ก่อนส่ง `assign_licenses()`
- ทำให้ `assign_licenses()` ทำงานกับทั้ง format (dict ที่มี skuId แล้ว หรือ dict ที่มีแค่ skuPartNumber)

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python -c "
from tasks.sync_user import normalize_payload
p = normalize_payload({'requester_info': {'name_english': 'Mr. Test User', 'employee_id': '1234', 'department': 'Engineering', 'company': 'AAPICO'}})
skus = p['task_data']['microsoft_365_licenses']['SkuId_id']
print('SKU format:', skus)
assert isinstance(skus[0], dict), f'Expected dict, got {type(skus[0])}'
print('SKU format fix OK')
"
```

---

### Step 7: อัปเดตเอกสาร Project ทั้งหมด (5 นาที)

**Files:**
- `.agent/project_structure.md`
- `worker/workspace.md`
- `worker/sequence.md`

**Change:**

**project_structure.md:**
- เพิ่ม `health_check.py` ในแผนผัง services directory
- อัปเดตคำอธิบาย Worker ให้รวม "Preflight health check before every pipeline" + "M365 user existence pre-check with retry"

**workspace.md:**
- เพิ่มหัวข้อ "ขั้นตอนที่ 0: Preflight Health Check" ก่อนขั้นตอนที่ 1
- อัปเดตขั้นตอนที่ 3 (M365) ให้รวม: pre-check user → retry loop → assign → done
- เพิ่ม sub-step "SKU Resolution" ใน Step 3

**sequence.md:**
- เพิ่ม Step 0: Preflight ใน Pipeline Sequence Overview table
- อัปเดต Step 3 sub-steps ให้มี 4 sub-steps: wait delay → check user exists → resolve SKUs → assign licenses
- เพิ่ม retry count ใน log recording pattern

**Verify:**
```powershell
Select-String -Path "c:\Users\wajeepradit.p\git\profile_automate\.agent\project_structure.md" -Pattern "health_check"
Select-String -Path "c:\Users\wajeepradit.p\git\profile_automate\worker\workspace.md" -Pattern "Preflight"
Select-String -Path "c:\Users\wajeepradit.p\git\profile_automate\worker\sequence.md" -Pattern "preflight"
```

---

### Step 8: เพิ่มระบบตรวจสอบการเชื่อมต่อเมื่อเริ่มทำงาน (Worker Startup Check) (10 นาที)

**Files:** `worker/run.py`, `worker/services/health_check.py`

**Change:**
1. ใน `worker/services/health_check.py` เพิ่ม method `check_database()` เพื่อรันคำสั่ง `SELECT 1` ตรวจสอบไฟล์ SQLite/DB
2. ใน `worker/services/health_check.py` เพิ่ม method `check_backend_api()` เป็น Placeholder เพื่อเชื่อมต่อไปยัง Backend (ถ้ามี)
3. ใน `worker/run.py` ก่อนที่จะเรียก `worker.work()` ให้เรียกใช้ฟังก์ชันตรวจสอบทั้งหมด (AD, Papercut, Redis, Graph API, Database, Backend API) ผ่าน `health_checker` 
4. แสดงผลลัพธ์สถานะเชื่อมต่อออกทางหน้าจอ Console (✅ / ❌) เพื่อให้ตรวจสอบได้ง่ายเมื่อเริ่ม Worker Container

**Verify:**
```powershell
cd c:\Users\wajeepradit.p\git\profile_automate\worker
python run.py
```

---

### Step 9: อัปเดต `sequence.md` ให้ครอบคลุม Graph API Connection (5 นาที)

**Files:** `worker/sequence.md`

**Change:**
- อัปเดตตาราง Pipeline Sequence ให้มีกระบวนการแสดงผลการเชื่อมต่อ Graph API Token ให้ชัดเจน
- เชื่อมโยงกับโค้ด `PDFProvisionTab.tsx` โดยการระบุ Message และ Status ที่ Frontend จะนำไปแสดงผลเมื่อ Graph API ล้มเหลวตั้งแต่ตอน Start Pipeline (Preflight)
- เพิ่ม Log Recording Pattern สำหรับกรณีเชื่อมต่อ Graph API ไม่สำเร็จ

**Verify:**
```powershell
Select-String -Path "c:\Users\wajeepradit.p\git\profile_automate\worker\sequence.md" -Pattern "Graph API"
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Graph API rate limit จาก repeated `GET /users/{upn}` | Low | Medium | Max 6 retries + exponential backoff (1m→32m) = ~7 calls ต่อ job |
| `resolve_sku_ids()` fail เพราะ permission ไม่มี `Organization.Read.All` | Medium | High | Fallback: ถ้า API fail → ใช้ hardcoded SKU map จาก config |
| Preflight false-positive (service ตอบช้าแต่ไม่ได้ตาย) | Low | Medium | ตั้ง timeout 5s ต่อ check, ไม่ retry ที่ preflight level |
| `_run_step` catch logic ผิด — M365UserNotSyncedError ถูก treat เป็น failure | Medium | High | Unit test ยืนยันว่า re-enqueue ไม่ทำให้ job fail |
| Mock mode regression (health check / pre-check ทำให้ mock mode พัง) | Low | High | ทุก method ต้อง check `self.mock_mode` ก่อน |
| Worker ไม่สามารถ Start ได้หากตรวจสอบ Services ตอนเริ่มระบบไม่ผ่าน | Medium | High | ให้แสดงผลเตือน (Warning) ลง Console แต่ไม่ต้องหยุดการทำงาน (No Exit) เพื่อให้ Worker ยังคงทำงานต่อไปได้แม้บาง Service จะขัดข้องชั่วคราว |

## Rollback Plan

1. **Git revert**: ทุก change อยู่ใน commit เดียว → `git revert HEAD` กลับสู่สถานะเดิม
2. **Disable preflight**: เพิ่ม env var `SKIP_PREFLIGHT=true` เพื่อ bypass health check ในกรณีฉุกเฉิน (จะเพิ่มไว้ใน Step 4 เป็น safety valve)
3. **Disable M365 retry**: ตั้ง `MAX_RETRIES=0` ใน config เพื่อกลับเป็น behavior เดิม (try once, fail fast)
4. **SKU format**: เป็น backward-compatible — `assign_licenses()` ยังรับ dict ที่มี `skuId` ได้ตามเดิม
5. นำฟังก์ชัน Startup Check ออกจาก `run.py` หากรบกวนระยะเวลาในการ Boot ของ Worker
