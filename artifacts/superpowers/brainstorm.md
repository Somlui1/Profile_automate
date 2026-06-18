## Goal
ระบุสาเหตุที่จุดไข่ปลาสถานะ "Creating Account", "Microsoft 365" และ "Welcome Email" ยังเป็นสีเทา (STANDBY) บนหน้า UI ถึงแม้ว่าจะลบ Database บน Server แล้วก็ตาม

## Constraints
- ต้องอธิบายให้ชัดเจนว่าปัญหาแต่ละจุดไข่ปลาเกิดขึ้นจากเงื่อนไขในโค้ด (Logic flow) ไม่ใช่บั๊กของ Database
- ต้องเสนอทางออกในการแก้โค้ด Python (worker/tasks/sync_user.py) เพื่อให้ส่ง State ได้ครบถ้วน

## Known context
หลังจากตรวจสอบ Log ที่ถูกส่งออกมาจาก API อย่างละเอียด พบว่า Database **ทำงานได้สมบูรณ์แบบแล้ว** และ `metadata` ก็ถูกส่งมายัง Frontend ได้อย่างถูกต้อง แต่ที่มันยังเป็นสีเทา เกิดจากสาเหตุดังต่อไปนี้:

1. **"Creating Account" (ad_creation -> naming)** เป็นสีเทา:
   - เนื่องจากคุณใช้ User `aduc.test` ซึ่งมีอยู่ในระบบอยู่แล้ว โค้ดใน `sync_user.py` บรรทัดที่ 262 จึงเข้าเงื่อนไข `User already exists. Skipping creation.`
   - เมื่อมัน Skip มันทำการเขียน Log `sub_step: connect` เป็น success แต่ **ไม่ได้เขียน Log สำหรับ `sub_step: naming` เลย!** 
   - พอ Frontend ไม่ได้รับข้อมูลของ `naming` มันจึงค้างสถานะไว้ที่ STANDBY (สีเทา) ตามค่าเริ่มต้น

2. **"Microsoft 365" (m365_license)** เป็นสีเทาทั้งยวง:
   - เป็นความตั้งใจของระบบ! ใน Log ระบุว่า `"Enqueuing m365_license task with a delay of 0:06:05"` 
   - ระบบถูกหน่วงเวลาไว้ 6 นาทีกว่าๆ เพื่อรอให้ Azure AD Sync สมบูรณ์ก่อน ทำให้ตอนนี้ยังไม่มี Log การรันใดๆ โผล่มา จุดเลยเป็นสีเทาเพราะมันยังไม่ถึงคิวรันครับ

3. **"Welcome Email"** เป็นสีเหลือง (Skipped):
   - ใน Payload ระบุว่า `"enable_send_email": false` ระบบจึงขึ้นสถานะ Skipped ให้ทั้งยวงอย่างถูกต้องแล้ว

## Risks
- หากปล่อยโค้ด `sync_user.py` ไว้แบบเดิม เวลาที่ Pipeline เจอ User ที่มีอยู่แล้ว มันก็จะ Skip การสร้าง ทำให้ UI เป็นสีเทาค้างตลอดไป สร้างความสับสนให้กับผู้ใช้งานได้
- ผู้ใช้อาจคิดว่าระบบพังหรือค้าง ทั้งที่ความจริงมันทำงานสำเร็จแล้ว

## Options (2–4)
1. **[อัปเดตโค้ด sync_user.py] (Recommended)**: เพิ่มคำสั่ง `add_log` สำหรับ `sub_step: naming` เป็นสถานะ `success` หรือ `skipped` ต่อท้ายบรรทัดที่ทำการ Skip creation เพื่อให้ Frontend มีข้อมูลมาระบายสีจุดไข่ปลา
2. **[แก้ Frontend]**: ให้ Frontend ฉลาดขึ้น ถ้าหาก Step หลัก (`ad_creation`) เป็น `success` ไปแล้ว ให้บังคับเปลี่ยนทุกจุดย่อยให้เป็นสีเขียวไปเลยโดยไม่ต้องรอ Log ย่อย (เสี่ยงต่อการหลอกผู้ใช้ในกรณีที่มี Error โผล่มากลางคัน)

## Recommendation
**Option 1: อัปเดตโค้ด sync_user.py**
ควรแก้ที่ต้นทางโดยการพิมพ์ Log แจ้งว่าข้ามการสร้าง Account เพื่อให้สอดคล้องกับโครงสร้าง Schema มากที่สุด

## Acceptance criteria
- เมื่อรัน User เดิมที่เคยมี Account อยู่แล้ว Frontend จะต้องแสดงจุดไข่ปลา "Creating Account" เป็นสีเขียว (Success) 
- M365 และ Email ยังคงทำงานตามเงื่อนไข Time delay และ Payload config ตามปกติ
