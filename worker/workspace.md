# ⚙️ Worker Service: Workflow & Architecture Summary

เอกสารนี้สรุปข้อมูลสถาปัตยกรรม (Architecture) และกระบวนการทำงาน (Workflow) ของ **Worker Service (Background Task Engine)** ในโครงการระบบจัดการบัญชีผู้ใช้และการซิงค์รหัสเครื่องพิมพ์

---

## 🏗️ 1. สถาปัตยกรรมระบบคิว (Worker Architecture)

Worker Service เป็นระบบประมวลผลพื้นหลังแบบ **Asynchronous & Decoupled Architecture** เพื่อแยกการทำงานที่ใช้เวลาประมวลผลสูง (เช่น การเชื่อมต่อ AD/LDAP, การรอการซิงค์ข้อมูล Cloud, การเรียก XML-RPC) ออกจาก Web Gateway หลัก

```text
                                [ FastAPI Gateway ]
                                         | (Enqueue Job)
                                         v
                                 [ Redis Broker ]
                                         |
                       +-----------------+-----------------+
                       | (Live Mode)                       | (Mock Mode / Debug Only)
                       v                                   v
             [ rq.Worker Instance ]             [ SQLite Polling Loop ]
                       |                                   |
                       +-----------------+-----------------+
                                         |
                                         v
                             [ run_sync_pipeline() ]
                                         |
                                (Normalize Payload)
                                         |
            +----------------------------+----------------------------+
            |                            |                            |
            v (Step 1)                   v (Step 2)                   v (Step 3: Delayed 5m)
     [ AD Creation ] ------------> [ PaperCut Sync ] ------------> [ M365 License ]
     (ldap3 Create +               (XML-RPC Trigger +            (Entra ID License
      Verify Properties)            Set Card PIN Code)            Assignment Simulation)
                                                                      |
                                                                      v (Step 4)
                                                             [ Send Onboarding Email ]
                                                             (SMTP Relay Notification)
```

### 🔌 ส่วนประกอบหลักของ Worker Daemon (`run.py`)
1. **Live Mode (Redis-Backed)**: ใช้ไลบรารี `rq` (Redis Queue) ในการเป็น Worker ดึงงานจากคิวชื่อ `sync` ใน Redis Server
2. **Mock Mode (SQLite-Backed / fallback)**: หากระบบอยู่ในสถานะดีบั๊ก (`DEBUG_MODE=True`) หรือไม่มี Redis ให้เชื่อมต่อระบบจะสร้าง **Mock Worker Loop** เพื่อคอยดึงแถวข้อมูลงานที่มีสถานะ `queued` ใน SQLite database มาประมวลผลในแบบวนรอบ (Polling Loop ทุกๆ 2 วินาที) ทำให้สามารถทดสอบและรันระบบแบบ Single-Node ได้โดยไม่ต้องใช้ Redis Container

---

## 🔄 2. ขั้นตอนการประมวลผลงานของคิว (Task Pipeline Workflow)

เมื่อระบบทำการดีคิว (Dequeue) งานเข้ามา ตัวรันงานจะเรียกฟังก์ชัน `run_sync_pipeline` ซึ่งทำงานเป็น **Multi-Step Queue Pipeline** ดังรายละเอียด:

### 2.1 ปรับระดับข้อมูลให้เป็นมาตรฐาน (Normalize Payload)
ก่อนเริ่มต้นประมวลผล ข้อมูลร้องขอจาก JSON จะถูกจัดวางโครงสร้างใหม่ให้อยู่ในฟอร์แมตข้อมูลระบบ (เช่น คำนวณหาชื่อผู้ใช้ (Logon Name) จากชื่อภาษาอังกฤษ, แปลงแอตทริบิวต์เป็นรูปแบบแอตทริบิวต์ใน ADUC และกำหนดลิขสิทธิ์เริ่มต้นแยกตามแผนกงานของผู้ใช้)

### 2.2 ขั้นตอนที่ 1: AD Creation Task (`run_ad_creation_task`)
* ทำการเชื่อมต่อกับ Active Directory Domain Controller ผ่าน LDAPs (Port 636)
* สร้าง Object ผู้ใช้ในสถานะปิดการใช้งานก่อน (Account Disabled) กำหนด UPN และรายละเอียดพนักงาน
* ทำการ **AD Attribute Validation**: ดึงข้อมูลผู้ใช้ที่พึ่งสร้างใน AD ออกมาเปรียบเทียบกับข้อมูลต้นทาง (Expected Properties) ว่าบันทึกค่าได้ถูกต้องและครบถ้วน 100% หรือไม่ หากไม่ตรงจะยกเลิกงานและขึ้นสถานะข้อผิดพลาด

### 2.3 ขั้นตอนที่ 2: PaperCut Sync Task (`run_papercut_task`)
* ส่งสัญญานเรียกใช้งาน API ของ PaperCut Server ผ่าน XML-RPC (Port 9191) ด้วยฟังก์ชัน `performUserAndGroupSync` เพื่อกระตุ้นให้เครื่องพิมพ์ดึงโครงสร้างชื่อผู้ใช้ใหม่จาก AD ลงสู่ฐานข้อมูลเครื่องพิมพ์ทันที
* ทำการดีเลย์ 2 วินาทีเพื่อให้เครื่องพิมพ์ทำงานเสร็จ
* เรียก API เพื่อเปลี่ยนแอตทริบิวต์ผู้พิมพ์: กำหนดรหัสบัตรและ PIN โค้ดสำหรับเครื่องพิมพ์ (`set_user_primary_card`) โดยใช้รหัสพนักงานหรือรหัสที่ผู้ดูแลระบบกำหนดเอง

### 2.4 ขั้นตอนที่ 3: Microsoft 365 License Task (`run_m365_license_task`)
* **กระบวนการทำงานมี 2 ขั้นตอนย่อย (Sub-sequence):** (รายละเอียดมาตรฐานการบันทึกและแสดงผลแบบละเอียดดูได้ที่ [sequence.md](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/sequence.md))
  1. **สเต็ปที่ 1: การรอคอยการซิงค์ข้อมูล (Entra Cloud Sync / Azure AD Connect)**: ในโปรดักชันระบบจะใช้ RQ delayed execution พักงานไว้ 5 นาที (`sync_queue.enqueue_in(timedelta(minutes=5), ...)`) เพื่อรอให้บัญชี AD On-premises ถูกซิงค์ขึ้นสู่ระบบ Cloud Azure AD (Entra ID)
  2. **สเต็ปที่ 2: การผูกลิขสิทธิ์ (License Assignment)**: ดำเนินการผูกลิขสิทธิ์ (เช่น E3, M365 Business, EMS) ไปยังบัญชีเป้าหมายผ่าน Graph API
* **การจำลองในระบบดีบั๊ก**: สำหรับ Mock Mode ระบบจะดีเลย์สเต็ปย่อยสั้นๆ และแสดงสถานะสเต็ปย่อยทั้งสองบนหน้าคอนโซลควบคุมหลักเพื่อให้ทดสอบระบบเสร็จรวดเร็วขึ้น

### 2.5 ขั้นตอนที่ 4: Email Notification Task (`run_send_email_task`)
* เชื่อมต่อกับ SMTP Relay Server ขององค์กร (โดยทั่วไปรันบน Port 25 แบบระบุ IP เชื่อมต่อโดยไม่ต้องยืนยันตัวตน)
* จัดส่งอีเมลคำต้อนรับ (Onboarding Email) ไปหาหัวหน้างาน (Supervisor) และส่งสำเนา (CC) ไปยังอีเมล IT Support

---

## ⏸️ 3. ระบบควบคุมกระบวนการ (Pause/Resume/Cancel Control)

การทำงานของแต่ละขั้นตอนจะมีตัวช่วยควบคุมความมั่นคงปลอดภัยและความยืดหยุ่นดังนี้:

* **การตรวจสอบก่อนทำแต่ละขั้นตอน (`check_job_status`)**: 
  ก่อนที่คิวงานจะเริ่มต้นทำงานในแต่ละสเต็ปย่อย (เช่น ก่อนเริ่ม PaperCut หรือ M365) ระบบจะตรวจสอบสถานะล่าสุดของงานใน SQLite ก่อนเสมอ
* **กรณีการ Pause**: 
  หากสถานะในฐานข้อมูลเป็น `paused` ตัว Worker จะทำงานแบบ Loop Waiting (ตรวจสอบสถานะทุกๆ 2 วินาที) โดยหยุดนิ่งอยู่ที่ขั้นตอนนั้นๆ จนกว่าสถานะจะได้รับการอัปเดตกลับมาเป็น `processing` (จากคำสั่ง Resume) หรือ `cancelled`
* **กรณีการ Cancel / Rollback**: 
  หากพบสถานะเป็น `cancelled` ตัว Worker จะตัดจบลูปทันที และในระดับโครงสร้างระบบ (`worker/tasks/pipeline.py`) จะรองรับการทำงานย้อนกลับ (Rollback) เช่น ทำการลบบัญชีผู้ใช้ใน AD ที่พึ่งสร้างขึ้นออกไปทันทีเพื่อรักษาสภาพความสะอาดของฐานข้อมูล (Clean State) หากผู้ดูแลระบบคลิกยกเลิกงาน
