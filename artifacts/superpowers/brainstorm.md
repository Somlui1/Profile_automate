## Goal
ระบุสาเหตุที่ Sub-steps ในหน้า Job Queue ยังคงแสดงสถานะเป็นสีเทา (STANDBY) ทั้งที่แก้โค้ด UI ไปแล้ว และหาทางแก้ไขระบบ Log ทั้งหมดให้ทำงานได้จริง รวมถึงป้องกันไม่ให้เกิดปัญหาเดิมซ้ำ

## Constraints
- ต้องไม่ทำให้ข้อมูล log เก่าสูญหาย
- ต้องใช้วิธีการ Migrate ฐานข้อมูลที่ถูกต้องกับ SQLite
- แก้ไขปัญหา Background worker ที่ค้างอยู่ (Stale process)

## Known context
- โค้ดฝั่ง UI ได้ถูกซ่อมแซมให้ดึง `log.metadata.sub_step` ตาม schema ที่ถูกต้องแล้ว
- เมื่อตรวจสอบฐานข้อมูล `data/jobs.db` พบว่าตาราง `job_logs` **ไม่มีคอลัมน์ `metadata TEXT`** อยู่ในตารางจริง เนื่องจากฐานข้อมูลถูกสร้าง (init_db) ไปก่อนหน้าที่จะมีการเพิ่มฟิลด์นี้ในโค้ด (SQLite `CREATE TABLE IF NOT EXISTS` จะไม่ไปเพิ่มคอลัมน์ใหม่ให้ตารางที่มีอยู่แล้ว)
- สาเหตุที่ระบบไม่พัง (Crash) ระหว่างทำงาน เนื่องจาก **Background Worker (Python/RQ)** ที่รันอยู่ เป็น Process เก่าที่ค้างอยู่ในหน่วยความจำ ซึ่งรันโค้ด `add_log` เวอร์ชันเก่า (เวอร์ชันที่ไม่ได้ Insert คอลัมน์ `metadata`)
- หาก Restart Worker ในตอนนี้ ระบบจะพังทันที (`sqlite3.OperationalError: table job_logs has no column named metadata`) เพราะโค้ดใหม่จะพยายาม Insert เข้าคอลัมน์ที่ไม่มีอยู่จริง ทำให้การทำงานของ Pipeline ไม่สามารถเซฟ log และอาจจะทำให้ระบบล่มได้
- ฝั่ง Frontend เมื่อดึง API `/logs` จะได้ข้อมูลที่ไม่มี `metadata` เพราะฐานข้อมูลไม่มีให้เก็บ จึงเป็นผลให้จุดไข่ปลาสถานะเป็น STANDBY ตลอดกาล

## Risks
- หากทำการลบฐานข้อมูลทิ้ง (`rm data/jobs.db`) ข้อมูล Job เก่าๆ จะหายไปทั้งหมด
- หากแก้แต่ Database แต่ไม่ Restart Worker โค้ดที่รันอยู่ก็จะยังคงส่งค่าโดยไม่มี `metadata` เข้ามาอยู่ดี (Process เก่า)
- หาก Restart Worker ก่อนที่จะแก้ Database ระบบจะ Crash เพราะการ Schema Mismatch

## Options (2–4)
1. **[Database Migration] (Recommended)**: ใช้คำสั่ง SQL `ALTER TABLE job_logs ADD COLUMN metadata TEXT;` เพื่อเพิ่มคอลัมน์เข้าฐานข้อมูลเดิมโดยไม่ให้ข้อมูลเก่าหาย จากนั้นค้นหาและ Kill Process ของ Worker เก่าทั้งหมด และ Start API / Worker ขึ้นมาใหม่ เพื่อให้ระบบโหลดโค้ดตัวปัจจุบันขึ้นมาใช้งาน
2. **[Hard Reset Database]**: ลบไฟล์ `data/jobs.db` ทิ้งแล้วให้ระบบสร้างใหม่ (ข้อมูลหายหมด) แล้วทำการ Restart Process ทุกตัวให้ใช้โค้ดใหม่ล่าสุด (เหมาะสำหรับ Development environment ที่ไม่ต้องกังวลเรื่องข้อมูล)
3. **[Frontend Mocking]**: เลิกใช้ `metadata` จาก Backend แล้วพยายาม Parse คำจากข้อความ Log (message) บน Frontend โดยใช้ Regex จับคำ (ไม่แนะนำอย่างยิ่ง เพราะซับซ้อนและผิดพลาดได้ง่าย)

## Recommendation
**Option 1: Database Migration** 
เป็นการแก้ปัญหาที่ต้นเหตุ (Root Cause) ได้อย่างถูกต้องที่สุด และปกป้องข้อมูลเดิมที่มีอยู่ โดยจะต้องไล่ปิด Process เก่าที่ค้างอยู่เพื่อให้มั่นใจว่าระบบจะรันโค้ดเวอร์ชันล่าสุดเสมอและจะไม่เกิดความขัดแย้งของข้อมูล

## Acceptance criteria
- คอลัมน์ `metadata TEXT` ถูกสร้างเพิ่มในตาราง `job_logs` ในไฟล์ `data/jobs.db`
- ไม่มี Python Worker process เก่าที่หลงเหลืออยู่ในระบบ
- เมื่อรัน API (และ Worker) ใหม่อีกครั้ง แล้วลองสร้าง Job ใหม่ ระบบจะต้องบันทึก JSON ลงไปในฐานข้อมูลได้อย่างถูกต้อง และหน้าจอ UI จะแสดงจุดไข่ปลา Sub-step (เขียว/แดง/กระพริบ) ตามสถานะจริง
