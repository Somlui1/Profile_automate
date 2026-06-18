## Goal
วิเคราะห์ระบบบันทึก Log ในปัจจุบัน และเสนอแนวทางการปรับปรุงโครงสร้าง Log ของระบบอย่างละเอียด เพื่อให้ระบบ Frontend สามารถแสดงผลสถานะย่อย (Sub-steps) และความคืบหน้า (Progress) ได้อย่างแม่นยำและเป็นระบบ โดยไม่ต้องพึ่งพาการแกะข้อความ (String Matching/Regex Parsing) ที่เปราะบางและบำรุงรักษายาก

## Constraints
- ระบบใช้ SQLite (`jobs.db`) ในการบันทึกข้อมูล ซึ่งแชร์ร่วมกันระหว่าง API และ Worker ผ่าน Docker volume
- การปรับเปลี่ยน Schema ของ Database ต้องทำด้วยความระมัดระวัง (เช่น ใช้ `ALTER TABLE ADD COLUMN` เพื่อรักษาข้อมูลเก่าและไม่ให้ระบบพัง)
- ฟังก์ชัน `add_log` ถูกเรียกใช้งานหลายจุดใน `worker/tasks/sync_user.py` และ `worker/tasks/pipeline.py` ต้องออกแบบโครงสร้างใหม่ให้ Backward Compatible เพื่อไม่ให้ระบบเดิมหยุดทำงาน
- การดึง Log ของระบบ Frontend ผ่าน REST API (`GET /api/v1/jobs/{job_id}/logs`) และ Real-time SSE Stream (`GET /api/v1/jobs/{job_id}/stream`) จะต้องสามารถส่งและแปลงข้อมูลโครงสร้างแบบใหม่ไปใช้งานได้โดยไม่ขัดข้อง

## Known context
1. **การทำงานของ Worker ในการบันทึก Log**:
   - Worker เป็น RQ (Redis Queue) Worker รันผ่าน Python
   - เมื่อมีการรันงาน provisioning ของผู้ใช้ (เช่น AD Creation, PaperCut Sync, M365 Licenses, Onboarding Email) Worker จะเรียกฟังก์ชัน `add_log(job_id, step, status, message)` จาก `core/database.py` เพื่อบันทึกประวัติการทำงานลงในตาราง `job_logs`
2. **โครงสร้างของ Log Database ปัจจุบัน**:
   - SQLite Database (`jobs.db`) รันอยู่บนโฮสต์/คอนเทนเนอร์ โดยแชร์ผ่าน Shared Volume
   - ตาราง `job_logs` ในฐานข้อมูลมี Schema ดังนี้:
     - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
     - `job_id`: TEXT NOT NULL (FOREIGN KEY โยงกับตาราง `jobs` ON DELETE CASCADE)
     - `step`: TEXT NOT NULL (เช่น `ad_creation`, `papercut_sync`, `m365_license`, `send_email`)
     - `status`: TEXT NOT NULL (เช่น `pending`, `running`, `success`, `failed`, `skipped`)
     - `message`: TEXT (เช่น `"Verify Pass: ..."`, `"Checking if user exists..."`)
     - `timestamp`: DATETIME
3. **การบันทึกผ่าน API หรือ Connector**:
   - Worker บันทึก Log ลงใน Database โดยตรงผ่าน **Database Connector** (`sqlite3` module ใน Python) ไม่ได้เรียกผ่าน REST API เนื่องจากรันอยู่ในสภาพแวดล้อมที่สามารถเข้าถึงไฟล์ `jobs.db` ร่วมกันผ่าน Docker Volume Mount (`./data:/app/data`) ได้โดยตรง
4. **การดึงข้อมูล Log ของ Frontend**:
   - **REST API (Pull)**: ดึงข้อมูลเมื่อผู้ใช้กดขยายแถวข้อมูลในหน้าประวัติงาน (`JobQueueTab.tsx`) ผ่าน API `GET /api/v1/jobs/{job_id}/logs`
   - **SSE Stream (Real-time)**: ดึงข้อมูลแบบเรียลไทม์เพื่อแสดงผลในหน้า Sequence Provisioning (`PDFProvisionTab.tsx`) ผ่าน SSE API `GET /api/v1/jobs/{job_id}/stream`
   - **ปัญหาที่พบ**: ปัจจุบัน Frontend มีการตรวจสอบข้อความดิบ (เช่น `message.includes("Verify Pass")` หรือ `message.includes("found in Azure AD")`) เพื่อวิเคราะห์ขั้นตอนย่อยและอัปเดต UI Progress Bar ซึ่งเป็นวิธีที่เปราะบาง หากมีการเปลี่ยนแปลงข้อความแจ้งเตือนทางหลังบ้าน จะส่งผลให้การวิเคราะห์ UI ผิดพลาดทันที

## Risks
- **Database Schema Migration**: การแก้ไข Schema ตาราง `job_logs` บน SQLite ที่มีการใช้งานอยู่แล้ว จำเป็นต้องทำแบบปลอดภัยและรัดกุม (เช่น ตรวจสอบความมีอยู่ของคอลัมน์ก่อนทำการเพิ่ม หรือทำ Migration script)
- **Backward Compatibility**: การอัปเกรดลายเซ็นฟังก์ชัน `add_log` ต้องไม่กระทบกับการเรียกใช้งานจุดเดิมที่อาจไม่ได้ส่งพารามิเตอร์ `metadata` ใหม่มาด้วย
- **SSE Data Parsing**: การแปลงข้อมูลระหว่าง Python objects และ JSON ในฝั่ง SSE starlette ต้องมั่นใจว่าจะไม่มีผลกระทบต่อประสิทธิภาพการสตรีมและสามารถ deserialize ในฝั่ง JS/TS ได้อย่างไร้ปัญหา

## Options (2–4)
1. **Option 1: เพิ่มคอลัมน์ `metadata` แบบ JSON/TEXT ในตาราง `job_logs` (Recommended)**
   - เพิ่มฟิลด์ `metadata TEXT` ลงในตาราง `job_logs`
   - ปรับปรุงฟังก์ชัน `add_log(..., metadata: dict = None)` ให้ทำการ `json.dumps()` บันทึกเป็น TEXT
   - อัปเกรด API Endpoint และ SSE generator ให้ดึงข้อมูลและ deserializes กลับเป็น object ส่งกลับไปยัง Frontend
   - *ข้อดี*: ยืดหยุ่นสูงมาก รองรับความต้องการข้อมูลเพิ่มเติมในอนาคตได้ง่าย (เช่น การเก็บค่า retry count, active SKUs, debug traces) โดยไม่ต้องแก้ไขโครงสร้าง Database อีก
   - *ข้อเสีย*: การสืบค้นในระดับฐานข้อมูลสำหรับฟิลด์ JSON ของ SQLite ต้องเขียนคิวรีซับซ้อนขึ้นเล็กน้อย (แต่ไม่ใช่ปัญหาสำหรับการดึง Log รายงานการรันงาน)
2. **Option 2: เพิ่มคอลัมน์เฉพาะเจาะจงแยกตามฟิลด์ (`sub_step` และ `log_type` เป็นต้น)**
   - เพิ่มคอลัมน์ `sub_step TEXT` และ `log_type TEXT` ลงใน Schema โดยตรง
   - *ข้อดี*: มีความชัดเจนในโครงสร้างฐานข้อมูล ค้นหาข้อมูลได้สะดวกรวดเร็วผ่านคำสั่ง SQL ปกติ
   - *ข้อเสีย*: ขาดความยืดหยุ่น หากในอนาคตต้องการจัดเก็บฟิลด์เสริมอื่นจำเป็นต้องแก้ Schema และ Migration ตลอดเวลา
3. **Option 3: การใช้ Prefix Tagging ใน Message เดิม (ไม่ต้องเปลี่ยน Schema)**
   - เก็บโครงสร้างข้อมูลไว้ที่คอลัมน์ `message` เหมือนเดิม แต่เปลี่ยนรูปแบบเป็น structured string เช่น `[SUB:ad_verify][STATUS:OK] message...`
   - *ข้อดี*: ไม่มีการแก้ไขโครงสร้าง Database ปัจจุบันใดๆ ทั้งสิ้น
   - *ข้อเสีย*: ปัญหาความเปราะบางในการแก้ไขและพัฒนาในระยะยาว ระบบยังคงต้องทำการ Parse ข้อความผ่าน RegExp ฝั่ง Frontend ซึ่งจัดการยาก

## Recommendation
**เลือก Option 1: เพิ่มคอลัมน์ `metadata` แบบ JSON/TEXT**
เนื่องจากเป็นแนวทางที่เป็นมาตรฐานอุตสาหกรรม (Structured Logging) ที่มีความยืดหยุ่นสูงสุด แยกความรับผิดชอบของข้อความดิบ (Human-readable Message) ออกจากโครงสร้างสถานะระบบ (System State Metadata) ได้อย่างเด็ดขาด ช่วยให้ฝั่ง Frontend สามารถเช็คข้อมูลได้โดยตรงผ่าน `log.metadata.sub_step` หรือคีย์เชิงโครงสร้างอื่นๆ โดยไม่พังหากมีการแก้ไขข้อความความคืบหน้าฝั่งหลังบ้าน

## Acceptance criteria
- [ ] มีการอัปเดตไฟล์ `api/core/database.py` และ `worker/core/database.py` ให้ครอบคลุมการเพิ่มคอลัมน์ `metadata TEXT` ในการสร้างตาราง `job_logs` (รวมถึงระบบ Auto-migrate คอลัมน์หากมี Database เดิมอยู่แล้ว)
- [ ] ฟังก์ชัน `add_log` ในทั้งฝั่ง API และ Worker รองรับพารามิเตอร์ `metadata: dict = None` และแปลงเป็น JSON string ก่อนบันทึก
- [ ] ฟังก์ชัน `get_logs` และ SSE Endpoint `/stream` ทำการ `json.loads` ฟิลด์ `metadata` กลับเป็น Object/Dict ก่อนส่งออกให้ Frontend
- [ ] ปรับปรุงการส่ง Log ใน `sync_user.py` และ `pipeline.py` ให้เริ่มส่งข้อมูลโครงสร้าง `metadata` ในสเต็ปที่สำคัญ (เช่น `{"sub_step": "azure_check"}`, `{"sub_step": "printer_pin_assignment"}`)
- [ ] ปรับปรุง `JobQueueTab.tsx` และ `PDFProvisionTab.tsx` ใน Frontend ให้เรียกอ่านและตรวจสอบความคืบหน้าของงานย่อยผ่านคุณสมบัติ `metadata.sub_step` แทนการทำ String matching
