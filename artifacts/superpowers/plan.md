# แผนการนำส่งคุณสมบัติ Dynamic Step Rendering (Zero-change Frontend)

ปรับปรุงระบบการแสดงผลขั้นตอนการทำงานบน Frontend ([PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx) และ [JobQueueTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/JobQueueTab.tsx)) ให้เป็นแบบ Schema-driven โดยอ่านโครงสร้างขั้นตอนหลัก (Steps) และขั้นตอนย่อย (Sub-steps) ทั้งหมดจากไฟล์การตั้งค่าส่วนกลาง `worker/steps_schema.json` ทำให้เมื่อมีการเพิ่มขั้นตอนใหม่ในฝั่ง Backend/Worker ในอนาคต (เช่น `sap_sync`) หน้าจอ Frontend จะปรับเปลี่ยนและแสดงผลได้ทันทีโดยไม่ต้องแก้ไขหรือคอมไพล์โค้ดใหม่

---

## 1. Goal (เป้าหมาย)
1. ย้ายการกำหนดโครงสร้าง Step & Sub-step ทั้งหมดไปไว้ที่ไฟล์ตั้งค่าหลักฝั่ง Backend (`worker/steps_schema.json`)
2. พัฒนา API `/api/v1/jobs/steps` เพื่อเปิดให้ Frontend ดึงโครงสร้างนี้ไปใช้งาน
3. ปรับปรุง [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx) และ [JobQueueTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/JobQueueTab.tsx) ให้เปลี่ยนจากโครงสร้างแบบ Hardcoded มาเป็นแบบวนลูป Render อัตโนมัติ (Dynamic Loop) ตามข้อมูลสเต็ปที่ได้จาก API
4. ปรับปรุงการบันทึก Log ในฝั่ง Worker และ API ให้ส่งฟิลด์ `metadata` แบบ JSON (สำหรับเช็คสถานะย่อยและประมวลผลความคืบหน้า)

---

## 2. User Review Required (สิ่งที่ต้องพิจารณา)
> [!IMPORTANT]
> **การเขียนคอมเม้นอธิบายในไฟล์ JSON (`worker/steps_schema.json`):**
> เนื่องจากรูปแบบมาตรฐานของ JSON ไม่รองรับการเขียนคอมเม้น `//` หรือ `/* */` (ซึ่งอาจทำให้ตัววิเคราะห์ JSON ของ Python/JS พังได้) เราจะใช้ฟิลด์พิเศษคือ `"_comment"` หรือ `"$description"` ในตัวโครงสร้าง JSON เอง เพื่อทำหน้าที่เป็นเอกสารคำแนะนำแก่ AI Agent และผู้ดูแลระบบในการแก้ไขและเพิ่มขั้นตอนใหม่ในอนาคต

---

## 3. Proposed Changes (รายการการเปลี่ยนแปลงที่เสนอ)

### [Component 1] Shared Configuration & API Schema

#### [NEW] [steps_schema.json](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/steps_schema.json)
* **การเปลี่ยนแปลง:** สร้างไฟล์ตั้งค่าความเคลื่อนไหวของขั้นตอนการจัดสรรสิทธิ์ ทั้ง Step, Sub-steps, Icon (ใช้ชื่อจาก Lucide Icons) และจัดทำคอมเม้นเชิงโครงสร้างสำหรับอธิบายขั้นตอนการทำงานไว้ในไฟล์

#### [MODIFY] [jobs.py (API)](file:///c:/Users/wajeepradit.p/git/profile_automate/api/endpoints/jobs.py)
* **การเปลี่ยนแปลง:**
  1. เพิ่ม Endpoint `GET /api/v1/jobs/steps` สำหรับอ่านและคืนค่า JSON จาก `worker/steps_schema.json` ให้กับ Frontend
  2. แก้ไขในฟังก์ชัน `job_stream` (SSE) ให้ตรวจสอบฟิลด์ `metadata` จากแถว Log และทำการ `json.loads` แปลง JSON string เป็น Python dict ก่อนส่งออกไปผ่าน Event stream เสมอ

---

### [Component 2] Database & Migration

#### [NEW] [migrate_logs_metadata.py](file:///c:/Users/wajeepradit.p/git/profile_automate/scripts/migrate_logs_metadata.py)
* **การเปลี่ยนแปลง:** สร้างสคริปต์เพื่อรันคำสั่ง `ALTER TABLE job_logs ADD COLUMN metadata TEXT` เพื่อรองรับการเก็บ JSON string ใน SQLite

#### [MODIFY] [database.py (API)](file:///c:/Users/wajeepradit.p/git/profile_automate/api/core/database.py) และ [database.py (Worker)](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/core/database.py)
* **การเปลี่ยนแปลง:**
  1. เพิ่มฟิลด์ `metadata TEXT` ใน SQLite `CREATE TABLE IF NOT EXISTS job_logs` เพื่อรองรับ Database ใหม่
  2. อัปเกรดฟังก์ชัน `add_log(job_id, step, status, message, metadata=None)` ให้แปลง `metadata` เป็น JSON string เซฟลง DB
  3. อัปเกรดฟังก์ชัน `get_logs(job_id)` ให้แปลงคอลัมน์ `metadata` กลับมาเป็น Python dictionary ก่อนส่งกลับ

---

### [Component 3] Worker Tasks Logging

#### [MODIFY] [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
* **การเปลี่ยนแปลง:** ปรับแต่งคำสั่ง `add_log()` ทุกคำสั่งในเวิร์กเกอร์ให้ส่งอาร์กิวเมนต์ `metadata` ระบุ `sub_step` และ `sub_step_status` เช่น:
  `add_log(job_id, "ad_creation", "running", "Checking conflict...", metadata={"sub_step": "check_user", "sub_step_status": "running"})`

---

### [Component 4] Frontend Integration (Dynamic UI Rendering)

#### [MODIFY] [types.ts](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/types.ts)
* **การเปลี่ยนแปลง:**
  - ปรับปรุงอินเตอร์เฟส `JobLog` และ `Job` ให้ใช้ `step` และ `current_step` เป็นประเภท `string` แทนสหภาพ (Union) เดิม
  - เพิ่มฟิลด์ `metadata` (แบบ Object หรือ Nullable) ลงในประเภท `JobLog`

#### [MODIFY] [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
* **การเปลี่ยนแปลง:**
  - เพิ่มการดึง API `GET /api/v1/jobs/steps` ตอนเริ่มต้นเก็บไว้ในสถานะ `stepsSchema`
  - ปรับปรุงการรับข้อมูลจาก SSE (`step_update`) ให้ดึงข้อมูลสถานะและคีย์ย่อยยัดลงใน Object `pipelineStates` ตามสเต็ป
  - แทนที่ส่วนจัดแสดงขั้นตอน Provisioning (AD, PaperCut, M365, Onboarding Email) ที่เคย Hardcode ไว้เดิม เป็นการวนลูป Render ผ่าน `stepsSchema` พร้อมแมปชื่อ Lucide Icon แบบไดนามิก

#### [MODIFY] [JobQueueTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/JobQueueTab.tsx)
* **การเปลี่ยนแปลง:**
  - ปรับปรุงการวาด Timeline คิวงานในหน้าหลัก และส่วนการสืบค้นประวัติย่อย (Checklists) ให้วนลูปผ่านรายการขั้นตอนที่ได้รับจาก API Steps แทนการใช้ Hardcoded Array

---

## 4. Verification Plan (แผนการทดสอบ)

### Automated Checks
1. รันสคริปต์ Migration:
   ```powershell
   python scripts/migrate_logs_metadata.py
   ```
2. รันสคริปต์ Mock Test ของ Worker เพื่อตรวจสอบว่าบันทึก `metadata` ลง DB ได้จริง:
   ```powershell
   python temp/mock_test_sync_user.py
   ```

### Manual Verification
1. เปิดระบบ API และ Frontend เช็คว่าแสดงผลหน้าจอหน้า Provisioning ได้ครบถ้วนเหมือนเดิม
2. ทำการเพิ่มขั้นตอนใหม่ตัวอย่าง (เช่น `sap_sync`) ลงใน `worker/steps_schema.json`:
   ```json
   {
     "key": "sap_sync",
     "display_name": "SAP Integration Sync",
     "description": "Syncing payroll data with SAP ERP",
     "icon": "Database",
     "sub_steps": [
       { "key": "sap_connect", "display_name": "Connecting SAP Host" },
       { "key": "sap_payload_push", "display_name": "Post Employee Master Data" }
     ]
   }
   ```
3. กดรีเฟรชหรือสลับหน้า Frontend สังเกตว่าในหน้าจอทั้ง `PDFProvisionTab.tsx` และ `JobQueueTab.tsx` จะแสดงสเต็ป "SAP Integration Sync" และขั้นตอนย่อยขึ้นมาบนหน้าต่างทันทีโดยไม่ต้องแก้ไขโค้ด React หรือสั่ง Build โฟลเดอร์หน้าบ้านใหม่เลย

---

## 5. Risks & Mitigations (ความเสี่ยง)
* **ความเสี่ยง:** การสะกดคำสั่งเรียก Lucide Icon ใน Schema หากเรียกตัวไม่มีอยู่ จะทำให้ React พัง
* **การป้องกัน:** ในโค้ด React จะเขียนตัวประมวลผลดักจับ (Dynamic Icon Picker component) ที่มี fallback เป็นไอคอนเริ่มต้น (เช่น `HelpCircle`) เสมอเพื่อความปลอดภัย

---

## 6. Rollback Plan (แผนการย้อนกลับ)
คืนค่าไฟล์ซอร์สโค้ดเดิมโดยใช้คำสั่ง:
```powershell
git restore api/core/database.py worker/core/database.py api/endpoints/jobs.py worker/tasks/sync_user.py frontend/src/types.ts frontend/src/components/PDFProvisionTab.tsx frontend/src/components/JobQueueTab.tsx
```
