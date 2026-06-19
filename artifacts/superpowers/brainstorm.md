# Brainstorm: Comparison of Group Addition in test_m365_step.py vs Frontend

## Goal
วิเคราะห์สาเหตุที่การยิง Request ผ่านสคริปต์ `test_m365_step.py` ทำงานได้สำเร็จโดยไม่มีปัญหาเกี่ยวกับกลุ่มสิทธิ์ (AD Groups) แต่เมื่อทำผ่านหน้าบ้าน (Frontend) ระบบกลับพบปัญหาและเกิดข้อผิดพลาดในการตรวจสอบ (AD Validation failures) อย่างต่อเนื่อง เพื่อหาแนวทางแก้ไขที่ตรงจุดและถาวร

## Constraints
- ห้ามเปลี่ยนสถาปัตยกรรมหลักของ Pipeline การทำงาน (AD Creation -> PaperCut -> M365 -> Onboarding Email)
- รักษาความเข้ากันได้และการแสดงผลของกระบวนการส่งต่อ Log ไปยังหน้าจอ UI

## Known context

### 1. ความแตกต่างในขั้นตอนที่รัน (Executed Steps Difference)
- **`test_m365_step.py`**: ในโค้ดของสคริปต์ทดสอบนี้ มีการสั่งรันเฉพาะฟังก์ชันสำหรับทำ M365 License เท่านั้น:
  ```python
  _execute_m365_license("test-job-m365-123", payload)
  ```
  สคริปต์นี้ **ไม่ได้สั่งรันขั้นตอนการสร้างบัญชี AD (`_execute_ad_creation`)** ดังนั้น จึงไม่มีการเชื่อมต่อ LDAP จริงเพื่อสร้างบัญชี หรือสืบค้นข้อมูลกลุ่มเพื่อทำ Validation ใดๆ การทำงานจึงขึ้นสถานะผ่าน (PASS) สำหรับ M365 เสมอ
- **Frontend / Full Pipeline**: เมื่อเริ่มกระบวนการผ่านหน้าบ้าน ระบบจะส่ง Payload เข้าสู่ Queue เพื่อทำงานในท่อประมวลผลจริง ซึ่งเริ่มด้วยขั้นตอน `ad_creation` และทำการเรียก `_execute_ad_creation` ซึ่งมีกระบวนการตรวจสอบค่า AD properties ที่เข้มงวด ส่งผลให้พบข้อผิดพลาดที่เกิดขึ้นจริงในระบบ LDAP AD

### 2. พฤติกรรมของ Primary Group ใน Active Directory
- กลุ่ม **`Domain Users`** เป็นกลุ่มหลัก (Primary Group) ของผู้ใช้เกือบทุกคนใน AD
- ตามสถาปัตยกรรมของ Active Directory แอตทริบิวต์ `memberOf` จะ**ไม่ส่งคืนค่ากลุ่มที่เป็น Primary Group** (ซึ่งก็คือ `Domain Users`) กลับมาเมื่อสอบถามข้อมูลผ่าน LDAP ทำให้ระบบคิดว่าผู้ใช้ไม่ได้อยู่ในกลุ่มนี้ แม้ว่าในความเป็นจริงจะสังกัดอยู่ก็ตาม

### 3. ความคลาดเคลื่อนในการค้นหากลุ่มสิทธิ์ระหว่าง API และ Worker
- **API Endpoint (`api/services/ad_service.py`)**: ค้นหากลุ่มสิทธิ์ด้วย Filter แบบยืดหยุ่น:
  ```python
  search_filter = f"(&(objectClass=group)(|(sAMAccountName={escaped_name})(cn={escaped_name})))"
  ```
- **Worker Service (`worker/services/ad_service.py`)**: ค้นหากลุ่มสิทธิ์เพื่อเพิ่มผู้ใช้เข้ากลุ่มด้วยฟิลเตอร์ที่แคบกว่ามาก:
  ```python
  search_filter = f"(&(objectClass=group)(cn={escaped_group}))"
  ```
  หากกลุ่มสิทธิ์ใน AD มีชื่อ `sAMAccountName` ไม่ตรงกับ `cn` ระบบ Worker จะค้นหาไม่พบและไม่ได้เพิ่มผู้ใช้รายนั้นเข้ากลุ่มจริง

## Risks
- การเปลี่ยน logic ตรวจจับกลุ่มสิทธิ์โดยไม่ระมัดระวังอาจทำให้ผู้ใช้ไม่ถูกแอดเข้ากลุ่มที่จำเป็นต่อสิทธิการใช้งานระบบไอที
- การดึงข้อมูลกลุ่ม `Domain Users` ที่ซับซ้อนเกินไป (เช่นการแกะ RID) อาจเพิ่ม LDAP overhead และเสี่ยงต่อการ timeout

## Options (2–4)

### Option 1 (Recommended): ทำการยกเว้นหรือตรวจสอบ Primary Group (Domain Users) เป็นกรณีพิเศษใน Validator
- **รายละเอียด**: ปรับปรุง Validator ฝั่ง Worker ใน [ad_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/ad_service.py) ให้เพิ่ม `"domain users"` เข้าไปในกลุ่มที่ค้นพบจริงโดยอัตโนมัติ เนื่องจากผู้ใช้ทุกคนใน AD มีกลุ่มนี้เป็นกลุ่มหลักอยู่แล้ว และปรับปรุง Filter การค้นหาของ Worker ให้เหมือนกับของ API เพื่อให้ค้นหากลุ่มโดยใช้ `sAMAccountName` ได้ด้วย
- **ข้อดี**: ปลอดภัยที่สุด แก้ไขปัญหา Primary Group ขาดหายจาก `memberOf` ได้อย่างถาวร และทำให้ Worker ค้นหากลุ่มเจอเหมือนกับที่ API หน้าบ้านค้นพบ
- **ข้อเสีย**: ต้องทำการแก้ไขโค้ดเพิ่มเล็กน้อยในฝั่ง Worker ad_service

### Option 2: นำกลุ่ม "Domain Users" ออกจาก payload ฝั่งหน้าบ้าน
- **รายละเอียด**: ปรับปรุงหน้าบ้าน [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx) ไม่ให้ส่งหรือบังคับแอดกลุ่ม `"Domain Users"` ไปใน payload
- **ข้อดี**: ลดปัญหาการเปรียบเทียบใน Validator ทันที
- **ข้อเสีย**: มีความเสี่ยงหากระบบ AD บางแห่งกำหนดกลุ่มหลักเป็นอย่างอื่น และหากพนักงานพยายามตรวจสอบ/แอดกลุ่มเริ่มต้นนี้ผ่าน UI

## Recommendation
แนะนำให้เลือก **Option 1** เนื่องจากเป็นการแก้ไขที่รากฐานของปัญหา ทั้งในแง่ของ Primary Group (ที่ LDAP ไม่อ่านค่าออกมา) และความสอดคล้องของการใช้ LDAP filter ระหว่าง API และ Worker ในการค้นหากลุ่มสิทธิ์

## Acceptance criteria
1. โค้ดตรวจสอบความถูกต้อง (Validator) ใน `worker/services/ad_service.py` จะข้ามการนำเอา `"domain users"` มาเป็นข้อผิดพลาดในกรณีที่ AD ไม่แสดงผลใน `memberOf`
2. ระบบค้นหากลุ่มสิทธิ์ใน `worker/services/ad_service.py` ใช้ Filter ค้นหาแบบเดียวกับ API เพื่อให้ค้นพบกลุ่มสิทธิ์ที่ระบุด้วย `sAMAccountName` ได้อย่างถูกต้อง
3. การรันผ่านหน้าบ้านส่งผลให้ขั้นตอน `ad_creation` ตรวจสอบผ่านสำเร็จและทำขั้นตอนต่อๆ ไปได้โดยไม่ติดขัด
