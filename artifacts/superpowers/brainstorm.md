# Brainstorm: ปรับปรุงขั้นตอน M365 License Assignment ให้ไม่เกิดข้อผิดพลาด

## Goal

ปรับปรุงขั้นตอน M365 License Assignment ใน provisioning pipeline ให้สามารถจัดการกับ **ความไม่แน่นอนของเวลา Azure AD Connect Sync** ได้อย่างน่าเชื่อถือ — ไม่ว่า user จะถูก sync ขึ้น Azure AD ช้าหรือเร็ว ระบบต้องสามารถ assign license ได้สำเร็จโดยไม่ fail

## Constraints

1. **Azure AD Connect Sync interval ไม่สามารถควบคุมได้ 100%** — ตั้งไว้ 5 นาทีแต่อาจใช้เวลามากกว่า (เช่น 7-10 นาที ในกรณี load สูง หรือ sync cycle พลาดรอบ)
2. **ไม่ต้องการเปลี่ยน infrastructure ใหญ่** — ต้องทำงานภายใน RQ Worker + Redis queue ที่มีอยู่
3. **ต้องไม่ block pipeline ถาวร** — ต้องมี max retry / timeout เพื่อป้องกัน infinite loop
4. **ต้อง log สถานะย่อยที่ชัดเจน** — เพื่อให้ frontend แสดง progress ที่แม่นยำ
5. **Credential ปัจจุบัน (Client Credentials flow) ถูกต้อง** — ปัญหาไม่ได้อยู่ที่ authentication

## Known Context

### สถาปัตยกรรมปัจจุบัน
- **Pipeline**: AD Create → PaperCut Sync → **(5m delay)** → M365 License → Send Email
- **Delay mechanism**: `sync_queue.enqueue_in(timedelta(seconds=300), ...)` — fixed delay 5 นาที
- **SYSTEM_MODE**: `live` (ไม่ใช่ mock — ดังนั้นเรียก Graph API จริง)
- **Error ที่เกิด**: `HTTP 400: Bad Request` จาก MS Graph `assignLicense` API

### Root Cause Analysis
1. **Primary**: User ยังไม่ sync ขึ้น Azure AD เมื่อ Graph API ถูกเรียก
   - Azure AD Connect sync ทุก 5 นาที แต่ timing ไม่ deterministic
   - Fixed 5 นาทีอาจไม่พอ — user อาจเพิ่ง miss sync cycle
2. **Secondary Bug**: SKU list ถูกส่งเป็น strings (`["sku-ems", "sku-standardpack"]`) แต่ `assign_licenses()` ต้องการ `List[Dict]` ที่มี key `skuId` → `add_licenses` เป็น list ว่าง → Graph API ได้ payload ไม่ถูกต้อง

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| User ไม่ถูก sync ขึ้น Azure AD เลย (sync broken) | 🔴 High | ตั้ง max retry + alert admin เมื่อ timeout |
| Retry loop block worker thread นานเกินไป | 🟡 Medium | ใช้ RQ re-enqueue แทน blocking sleep |
| Graph API rate limiting จาก retry มากเกินไป | 🟢 Low | ใช้ exponential backoff + max 6 retries |
| SKU ID format ผิด (string แทน dict) | 🔴 High | แก้ normalize_payload ให้ map SKU name → GUID |
| Client Secret หมดอายุ | 🟡 Medium | เพิ่ม credential health check / เตือนล่วงหน้า |

## Options (4)

### Option 1: Exponential Backoff Retry (Simple)
- **วิธีการ**: เมื่อ `assign_licenses()` fail ด้วย HTTP 400 → re-enqueue task กลับเข้า queue ด้วย delay ที่เพิ่มขึ้นเรื่อยๆ (1m, 2m, 4m, 8m...)
- **ข้อดี**: ง่ายที่สุด, ไม่ต้องเปลี่ยน architecture
- **ข้อเสีย**: ไม่รู้ว่า user sync แล้วหรือยัง — retry อาจ fail หลายครั้งโดยไม่จำเป็น
- **Complexity**: ⭐ Low

### Option 2: Graph API Pre-check (Poll Before Assign)
- **วิธีการ**: ก่อน assign license ให้ **เรียก `GET /users/{upn}` ก่อน** เพื่อตรวจว่า user มีอยู่ใน Azure AD แล้วหรือยัง ถ้ายังไม่มี → re-enqueue ด้วย delay
- **ข้อดี**: รู้แน่ชัดว่า user พร้อมแล้วก่อน assign → ลด error rate เป็น 0
- **ข้อเสีย**: ต้องเพิ่ม API call 1 ครั้งต่อ attempt
- **Complexity**: ⭐⭐ Medium

### Option 3: Azure AD Webhook / Change Notification
- **วิธีการ**: ลงทะเบียน Microsoft Graph Change Notification ให้ trigger เมื่อมี user ใหม่ sync ขึ้นมา → จึงค่อย enqueue M365 task
- **ข้อดี**: Real-time, ไม่มี polling waste
- **ข้อเสีย**: ต้องตั้ง webhook endpoint (ต้อง public URL), ซับซ้อนมาก, ต้อง maintain subscription renewal
- **Complexity**: ⭐⭐⭐⭐ Very High

### Option 4: Hybrid — Graph Pre-check + Exponential Re-enqueue (Recommended)
- **วิธีการ**: 
  1. รักษา initial delay 5 นาที (ให้ sync cycle แรกผ่าน)
  2. เมื่อ task execute → **เรียก `GET /users/{upn}` ก่อน**
  3. ถ้า user ยังไม่มี → **re-enqueue กลับเข้า queue** ด้วย exponential backoff (60s, 120s, 240s...)
  4. ถ้า user มีแล้ว → assign license ตามปกติ
  5. ตั้ง max retry = 6 ครั้ง (รวม ~30 นาที max wait) → ถ้าเกิน → fail พร้อม alert
- **ข้อดี**: 
  - ไม่ block worker thread (ใช้ RQ re-enqueue)
  - รู้ 100% ว่า user พร้อมก่อน assign
  - มี safety net (max retry + timeout)
  - Log sub-step ชัดเจนสำหรับ frontend
- **ข้อเสีย**: ต้องเก็บ retry count ใน payload
- **Complexity**: ⭐⭐ Medium

## Recommendation

**➡️ Option 4: Hybrid (Graph Pre-check + Exponential Re-enqueue)** เป็นตัวเลือกที่ดีที่สุด เพราะ:

1. **แก้ root cause ตรงจุด**: ตรวจสอบก่อนว่า user sync แล้วจริง ไม่ใช่แค่เดาด้วย fixed delay
2. **ไม่ block worker**: ใช้ RQ re-enqueue → worker ว่างไปรับงานอื่นระหว่างรอ
3. **Fail-safe**: max retry ป้องกัน infinite loop
4. **Frontend-friendly**: log sub-step ชัดเจน (waiting → checking → assigning → done)

### นอกจากนี้ต้องแก้ bug เร่งด่วน:
- **แก้ SKU format**: `normalize_payload()` ต้อง map SKU part number strings เป็น `{"skuId": "GUID", "skuPartNumber": "name"}` dicts
- **เพิ่ม `check_user_exists()` method** ใน `m365_service.py` เพื่อเรียก `GET /users/{upn}`

## Acceptance Criteria

- [ ] M365 license assignment ไม่ fail ด้วย HTTP 400 เมื่อ user ยังไม่ sync
- [ ] ระบบ retry อัตโนมัติ สูงสุด 6 ครั้ง ด้วย exponential backoff
- [ ] ก่อน assign license ต้องตรวจ user existence ผ่าน Graph API เสมอ
- [ ] SKU IDs ถูก resolve จาก part number เป็น GUID ก่อนส่ง API
- [ ] Log sub-steps ชัดเจน: "Checking user existence" → "User found" → "Assigning licenses" → "Success"
- [ ] Max wait time ไม่เกิน 30 นาที → ถ้าเกินให้ fail พร้อม error message ที่ actionable
- [ ] Worker thread ไม่ถูก block ระหว่างรอ (ใช้ re-enqueue ไม่ใช่ sleep)
- [ ] Frontend แสดง retry count และสถานะการรอ sync ได้ถูกต้อง
- [ ] อัปเดตเอกสาร `.agent/project_structure.md`, `worker/workspace.md`, `worker/sequence.md` ให้สะท้อนการเปลี่ยนแปลง
