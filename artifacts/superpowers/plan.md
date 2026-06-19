## Goal
แก้ไขปัญหาที่เกิดขึ้น:
1. แก้ไขให้ฟังก์ชันสร้าง Payload ดึงค่า print_code จาก calculatedPin (ซึ่งจะดึงค่าจาก description ใน textarea เป็น fallback) เพื่ออัปเดตรหัสพิมพ์ใน Final API Payload ตามการแก้ไขในหน้าบ้านทันที
2. เพิ่มระบบ Self-healing Database Initialization ให้ API และ Worker ป้องกันปัญหา OperationalError: no such table: jobs โดยการสร้างตารางอัตโนมัติหากตรวจไม่พบตารางเมื่อเริ่มการเชื่อมต่อ

## Plan

### Step 1: อัปเดต Frontend Component (PDFProvisionTab.tsx)
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**: 
  - ปรับปรุงฟังก์ชัน `buildProvisionPayload()` ให้ตั้งค่า `papercut_profile.print_code` ด้วย `calculatedPin` (ไม่ใช่ `printCode` ตรงๆ)
  - ปรับปรุงเงื่อนไข `hasPrintCode` ให้เป็น `calculatedPin !== "N/A" && calculatedPin.trim() !== ""` เพื่อเปิด `enable_papercut_sync` หากเบอร์มือถือหรือ description มีรหัสพินพิมพ์
- **Verify**:
  - เมื่อพิมพ์แก้ไขเลขพินพิมพ์ในช่อง Task Description (textarea) เช่น `127456` และเปิด Payload Preview จะพบว่า `"print_code": "127456"` และ `"enable_papercut_sync": true` อัปเดตตรงตามที่แก้ไข

### Step 2: อัปเดต API Database Utility (api/core/database.py)
- **Files**: [database.py (API)](file:///c:/Users/wajeepradit.p/git/profile_automate/api/core/database.py)
- **Change**: 
  - เพิ่มระบบ Self-healing ใน `get_db_connection()` ให้ทำการสร้างตาราง `jobs` และ `job_logs` อัตโนมัติหากยังไม่มีตารางนี้อยู่ในฐานข้อมูล
- **Verify**:
  - รันการทดสอบและเรียกหน้าจอ Jobs บนหน้าบ้าน (หรือยิง GET /api/v1/jobs) แล้วตรวจสอบว่าไม่เจอข้อผิดพลาด no such table: jobs อีกต่อไป

### Step 3: อัปเดต Worker Database Utility (worker/core/database.py)
- **Files**: [database.py (Worker)](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/core/database.py)
- **Change**: 
  - ทำการอัปเดตระบบ Self-healing ใน `get_db_connection()` ของฝั่ง Worker เช่นเดียวกับฝั่ง API
- **Verify**:
  - รันแอปพลิเคชันและทดสอบการรัน Task จนเสร็จสิ้นโดยการดึงข้อมูลจากหน้าเว็บเป็นปกติ
