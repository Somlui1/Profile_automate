## Goal
แก้ไขปัญหาการอัปเดตกลุ่มสิทธิ์ (AD Groups) ที่ไม่ทำงานเนื่องจากข้อมูล `groups` ตกหล่นใน API Payload จากหน้าบ้าน และเพิ่มความเข้มงวดในการตรวจสอบ (Strict Verification) ของ AD Properties ทุกฟิลด์ก่อนจะอนุญาตให้รันในขั้นตอนถัดไป (เช่น PaperCut Sync และ M365 License) โดยการปรับปรุงทั้งหมดนี้ต้องไม่ส่งผลกระทบใดๆ ต่อการแสดงผล Logs บนระบบของหน้าบ้าน (Frontend Log Screen) และต้องแก้ไขเรื่องข้อจำกัดการค้นหากลุ่มด้วย CN เพียงอย่างเดียวของ Worker เพื่อรองรับการแอดกลุ่มด้วย sAMAccountName เหมือนของ API

## Assumptions
1. `UserSyncRequest` ของระบบหลังบ้านใช้ schema `Dict[str, Any]` สำหรับ `custom_attributes` ซึ่งรองรับการส่งฟิลด์ `groups` ในรูปแบบ `List[str]` ได้ทันทีโดยไม่ติดขัด Pydantic validation
2. ฟังก์ชันตรวจสอบ `ad_service.validate_user` มีความสามารถในการเปรียบเทียบฟิลด์ AD Properties ทั้งหมดและหากมีความผิดพลาดเกิดขึ้น ฟังก์ชันจะส่งสถานะ `val_success=False` กลับมา
3. การโยน `Exception` ในขั้นตอน `_execute_ad_creation` จะขัดขวางการเรียก `move_to_next_step` ของ `_run_step` ซึ่งจะหยุดการรัน pipeline ทันทีตามเงื่อนไข "ถ้าไม่ตรงห้ามทำ step ถัดไปเด็ดขาด"
4. โครงสร้างและรูปแบบการส่ง Log (SSE event stream) จะไม่มีการเปลี่ยนแปลงใดๆ เพื่อความเข้ากันได้ 100% กับส่วนของการแสดงผล Log บนหน้าบ้าน

## Plan

### Step 1: อัปเดต API Payload ใน Frontend เพื่อส่งข้อมูล AD Groups
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**: อัปเดตฟังก์ชัน `buildProvisionPayload()` ในส่วนของ `task_data.ad_profile.custom_attributes` ให้เพิ่มฟิลด์ `groups: adGroupsAssigned.map((g) => g.name)` เพื่อให้ระบบส่งรายชื่อกลุ่มสิทธิ์ทั้งหมดไปที่ Backend API
- **Verify**: 
  1. กด Provision จากหน้าเว็บ UI
  2. เปิด Chrome Developer Tools (Network Tab) ตรวจสอบ Payload ของ POST request ไปที่ `/api/v1/jobs/sync`
  3. ตรวจสอบว่าใน `custom_attributes` มีอาเรย์ `groups` บรรจุชื่อกลุ่มถูกต้อง เช่น `["Domain Users", "BW200"]`

### Step 2: ปรับปรุง Backend Validator และ LDAP Group Search Filter ของ Worker
- **Files**: [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py), [ad_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/ad_service.py)
- **Change**: 
  - ใน [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py): แก้ไขฟังก์ชัน `_execute_ad_creation` ให้สร้าง `expected_props` จากทุกคีย์ที่ถูกส่งเข้ามาทาง `custom_attributes` (ยกเว้นรหัสผ่าน `password` เนื่องจากเป็น write-only) พร้อมจัดการ fallback ค่าเริ่มต้น
  - ใน [ad_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/ad_service.py): ปรับปรุงใน `create_user` ให้ใช้ filter การค้นหากลุ่มสิทธิ์แบบเดียวกับฝั่ง API: `(&(objectClass=group)(|(sAMAccountName={escaped_group})(cn={escaped_group})))` เพื่อรองรับการแอดกลุ่มด้วย sAMAccountName ที่ค้นหามาจากหน้าบ้าน
- **Verify**:
  - รันโค้ดและส่ง Payload การทำงานตัวอย่างผ่านสคริปต์ทดสอบ
  - ตรวจสอบว่า Worker ค้นหากลุ่มด้วย sAMAccountName และแอดสมาชิกเข้ากลุ่มได้เรียบร้อยโดยไม่มี LDAP error

### Step 3: ตรวจสอบความถูกต้องแบบ End-to-End และผลกระทบต่อระบบแสดงผล Logs
- **Files**: ตรวจสอบผลลัพธ์ผ่านหน้าจอระบบและสคริปต์
- **Change**: การทดสอบการทำงานของระบบในภาพรวมและตรวจสอบความสอดคล้อง
- **Verify**:
  1. ทดลองตั้งใจทำให้เกิดความคลาดเคลื่อนของค่าใน AD (เช่น mock ให้ตรวจสอบไม่ตรงตาม payload) แล้วยืนยันว่าการทำงานล้มเหลวที่ขั้นตอน `ad_creation` ทันทีและไม่ดำเนินงานต่อในขั้นตอน `papercut_sync`
  2. ยืนยันว่าเมื่อการทดสอบผ่านสมบูรณ์ Logs การตรวจสอบ properties แต่ละตัว เช่น `Verify Pass: groups matches expected value` จะขึ้นแสดงผลเรียงตามปกติบนหน้าจอ Log ของหน้าบ้านโดยไม่ขัดข้องหรือค้าง

## Risks & mitigations
- **Risk**: ฟิลด์บางฟิลด์เช่น `manager` ค้นหาชื่อและได้ค่าเป็น DistinguishedName (DN) เต็มรูปแบบใน AD ขณะที่ payload เป็นเพียงชื่อคนธรรมดา
  - *Mitigation*: โค้ด validation ของ `ad_service.validate_user` มีการใช้เงื่อนไขตรวจสอบ `expected_cmp in actual_cmp` เพื่อรองรับความแตกต่างของรูปแบบข้อมูลนี้ไว้แล้ว จึงมีความปลอดภัย
- **Risk**: ค่าที่เป็นข้อความพิเศษหรือค่าว่าง `"{To be specified in Step 2}"` อาจมองว่าไม่ตรงกับใน AD ถ้า AD ไม่ได้เซ็ตค่า
  - *Mitigation*: เพิ่มการจัดการ fallback ใน validation เพื่อให้ฟิลด์ที่เป็นค่าเริ่มต้นหรือว่างเปรียบเทียบได้อย่างถูกต้อง

## Rollback plan
- นำการเปลี่ยนแปลงใน `frontend/src/components/PDFProvisionTab.tsx` ออกโดยลบฟิลด์ `groups` ออกจาก `buildProvisionPayload()` และกู้คืนฟังก์ชัน `_execute_ad_creation` ใน `worker/tasks/sync_user.py` และ `worker/services/ad_service.py` กลับเป็นรุ่นก่อนหน้า
