# Plan: Frontend Email Editor and Backend Dispatch Integration (Option 2)

## Goal
ปรับรูปแบบการทำงานให้ระบบ SMTP Welcome Email รองรับเนื้อหาข้อความสำเร็จรูป (`emailBody`) ที่ผู้ใช้ทำการแก้ไขผ่านหน้าเว็บ โดยเวิร์กเกอร์จะแปลงข้อความขึ้นบรรทัดใหม่ `\n` เป็น `<br>` และห่อหุ้มโครงสร้าง CSS/Aptos font จากนั้นจัดส่งออกเป็น HTML อีเมล 

หาก workflow มีการ enable เกี่ยวกับการส่ง Email (`enable_send_email: true`) เเต่ใน payload ไม่มี email body ให้ทำการ print error เเล้วยกเลิกการส่ง Email ทันที

## Assumptions
- ฟรอนต์เอนด์ส่งค่าข้อความ Plain Text ที่แก้ไขแล้วผ่าน JSON Payload ทางคีย์ `task_data.email_profile.emailBody`
- ระบบ SMTP ของเวิร์กเกอร์จะแปลงค่าและห่อหุ้มสไตล์ฟอนต์ให้สอดคล้องกับมาตรฐานองค์กร (Aptos/Calibri, 14px, line-height 1.5) เพื่อความสวยงามและคลิกลิงก์ต่างๆ ได้
- หาก workflow มีการ enable การส่งอีเมลแต่ไม่มีข้อความ `emailBody` ใน payload หรือส่งมาเป็นค่าว่าง ให้ทำการ print error และยกเลิกการส่งอีเมลนั้นทันที

## Plan

### Step 1: Update `email_service.py` to support custom email body
- **Files:** [email_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/email_service.py)
- **Change:**
  1. ปรับปรุงฟังก์ชัน `send_email(self, to_email: str, subject: str, cc_email: str = None, body: str = None)`
  2. หากพารามิเตอร์ `body` มีค่า:
     - ทำการแปลงเครื่องหมายขึ้นบรรทัดใหม่ `\n` เป็น `<br>`
     - ห่อหุ้มใน wrapper HTML โครงสร้างฟอนต์ Aptos/Calibri
     - ทำการส่งอีเมลตามการกำหนดค่า SMTP
  3. หากพารามิเตอร์ `body` ไม่มีค่าหรือว่างเปล่า ให้ส่งค่าผิดพลาด (Raise ValueError/Exception) กลับไป
- **Verify:** รันไพธอนคำสั่งตรวจเช็ค Syntax
  ```bash
  .\.venv\Scripts\python.exe -m py_compile worker/services/email_service.py
  ```

### Step 2: Update `_execute_send_email` in `sync_user.py` to validate body and call EmailService
- **Files:** [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
- **Change:**
  1. อิมพอร์ต `email_service` จาก `services.email_service`
  2. ตรวจสอบเงื่อนไขว่ามี `emailBody` ใน payload หรือไม่ (และต้องไม่ใช่ค่าว่างเปล่า)
  3. หากไม่มีหรือเป็นค่าว่าง:
     - ทำการ print error / log error เพื่อเเจ้งเตือน
     - ยกเลิกการส่ง Email ทันที และบันทึกประวัติการข้าม/ยกเลิกลงฐานข้อมูล
  4. หากมีค่า `emailBody` ถูกต้อง:
     - เรียกใช้งาน `email_service.send_email(..., body=email_body)`
- **Verify:** รันไพธอนคำสั่งตรวจเช็ค Syntax
  ```bash
  .\.venv\Scripts\python.exe -m py_compile worker/tasks/sync_user.py
  ```

### Step 3: Update Frontend to fetch and parse the custom HTML email template in Step 2
- **Files:**
  - [user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/endpoints/user.py)
  - [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change:**
  1. เพิ่ม endpoint `/api/v1/user/email-template` ใน `user.py` เพื่ออ่านและส่งเนื้อหาไฟล์ [mail_template.html](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/templates/mail_template.html) ให้ฟรอนต์เอนด์
  2. ปรับปรุงฟังก์ชัน `fetchEmailTemplate` ใน `PDFProvisionTab.tsx` ให้ fetch ข้อมูลจาก `/api/v1/user/email-template`
  3. ปรับปรุงการ Compile Dynamic Email Preview ใน `PDFProvisionTab.tsx` ให้รองรับและแทนที่ตัวแปรแบบ HTML/Jinja2 (เช่น `{{ username }}`) และซ่อนบล็อก `{% if ... %}` ตามเงื่อนไขจริงเพื่อแสดงผลบนหน้าจอแก้ไขข้อมูล Step 2 ได้อย่างสมบูรณ์
- **Verify:**
  1. รันไพธอนคำสั่งตรวจเช็ค Syntax ของ `user.py`
  2. ตรวจสอบในหน้า UI Step 2 ว่ามีค่าเริ่มต้นของอีเมลพรีวิวตามเทมเพลต HTML ถูกต้อง

### Step 4: Verify Custom Body Formatting and Validation in Unit Tests
- **Files:** [test_email.py](file:///C:/Users/wajeepradit.p/.gemini/antigravity-ide/brain/2c7c1ac5-5967-4e63-ad2b-dfe92c362d60/scratch/test_email.py)
- **Change:**
  1. ปรับปรุงสคริปต์เทสเพื่อทดสอบสถานการณ์ที่ส่ง `body` ที่มีข้อความธรรมดาพร้อมเครื่องหมาย `\n` เข้ามา และตรวจสอบสไตล์ HTML ที่แปลงแล้ว
  2. ทดสอบสถานการณ์ที่ไม่มีการส่ง `body` หรือส่งค่าว่างเปล่าเข้ามา และระบบต้องยกเลิก/ส่ง error ตามเงื่อนไข
- **Verify:** รันเทสสคริปต์
  ```bash
  .\.venv\Scripts\python.exe C:\Users\wajeepradit.p\.gemini\antigravity-ide\brain\2c7c1ac5-5967-4e63-ad2b-dfe92c362d60\scratch\test_email.py
  ```

### Step 5: Run Integration Mock Tests
- **Files:** None
- **Change:** ไม่มี
- **Verify:** รันชุดทดสอบความเรียบร้อยของ Pipeline
  ```bash
  .\.venv\Scripts\python.exe temp/mock_test_sync_user.py
  ```

## Risks & mitigations
- **Risk:** การพิมพ์หรือเซ็ตค่าผิดพลาดอาจทำให้อีเมลถูกยกเลิกบ่อยครั้ง
- **Mitigation:** แสดง Error ชัดเจนในระบบ Logging และระบบประวัติประมวลผล (add_log) เพื่อให้แอดมินหรือทีมช่วยเหลือเข้ามาอ่านหาสาเหตุได้ทันที

## Rollback plan
- ใช้ git เพื่อย้อนค่าโค้ดกลับไปยังเวอร์ชันก่อนหน้า:
  ```bash
  git restore worker/services/email_service.py worker/tasks/sync_user.py api/endpoints/user.py frontend/src/components/PDFProvisionTab.tsx
  ```
