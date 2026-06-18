# Superpowers Brainstorm

## Goal
ปรับโครงสร้างโปรเจกต์และสร้างระบบเอกสาร (Markdown) ให้เป็น **AI-Friendly Repository** อย่างเต็มรูปแบบ เพื่อให้ AI (เช่นตัวผมเอง) สามารถทำความเข้าใจ Context, ขอบเขตการทำงาน, และโครงสร้างข้อมูลได้อย่างรวดเร็ว แม่นยำ รวมทั้งกำจัดไฟล์ขยะเพื่อลด Token ในการประมวลผล

## Constraints
- เอกสารอธิบายโครงสร้างต้องกระชับ (Concise) ไม่อธิบายยืดเยื้อจนเปลือง Context window ของ AI
- การเขียน Markdown ไม่ควรลึกถึงระดับบรรทัดต่อบรรทัด (เพราะโค้ดเปลี่ยนบ่อย) แต่ควรเน้นที่ระดับ "ภาพรวม" และ "การเชื่อมต่อระหว่างระบบ" (Architecture & Data Flow)
- ฟังก์ชันการทำงานเดิมของระบบ Provisioning (AD, Papercut, M365) ต้องทำงานได้ปกติหลังจัดโครงสร้าง

## Known context
- โปรเจกต์ปัจจุบันแบ่งเป็น 3 ส่วนหลักอย่างชัดเจน: `api` (FastAPI), `worker` (RQ/Redis), `frontend` (React/Vite)
- มีการใช้ระบบ `steps_schema.json` เพื่อเชื่อม Data contract ระหว่าง Worker กับ Frontend แล้ว
- โปรเจกต์มีโฟลเดอร์ขยะ เช่น `temp/` ที่ใช้เขียนสคริปต์แก้ไขเฉพาะกิจสะสมอยู่ และอาจมีโค้ดเก่าที่ไม่ได้ใช้

## Risks
- **Outdated Documentation**: หากเขียน Markdown ไว้ทุกที่แบบละเอียดยิบ เมื่อมีการแก้โค้ดแต่ลืมแก้ Markdown จะทำให้ AI สับสน (Hallucination) ในอนาคต
- **Over-fragmentation**: การแยกไฟล์ย่อยเยอะเกินไป ทำให้ AI ต้องใช้ Tool สแกนไฟล์หลายรอบกว่าจะเจอจุดที่ต้องแก้

## Options (2–4)
1. **AI-Context Files + Aggressive Pruning (แนะนำ)**:
   - สแกนและลบไฟล์จำพวก `temp/`, `scripts/` เก่าๆ, คอมเมนต์โค้ดตาย (Dead code) ออกให้หมด
   - สร้างไฟล์ `ARCHITECTURE.md` หรือ `README-AI.md` ในแต่ละโฟลเดอร์หลัก (`api`, `worker`, `frontend`) อธิบายเฉพาะ Data flow และหลักการ (เช่น กฎของการทำ SSE)
   - ใช้ Docstrings / JSDoc อธิบายพารามิเตอร์ภายในฟังก์ชันแทนการสร้างไฟล์แยก

2. **Knowledge Base System**:
   - พัฒนาโฟลเดอร์ `.agent/knowledge/` เก็บ Design Decisions สำคัญๆ (เช่น วิธีการ Map M365 Licenses หรือวิธีคุยกับ AD) เป็นไฟล์ Markdown ย่อยๆ 
   - เมื่อ AI จะทำงานเรื่องไหน ก็ให้ไปอ่าน Knowledge เรื่องนั้นๆ ก่อน

3. **Inline Self-Documenting Only**:
   - ไม่สร้างไฟล์ Markdown แยกเลย แต่บังคับให้ใส่ JSDoc และ Python Type Hints ทุกจุด 
   - ข้อเสียคือ AI อาจจะไม่เห็น "ภาพรวม" ของทั้งระบบเวลาต้องเชื่อมต่อ API กับ Frontend

## Recommendation
**เลือกใช้วิธีผสมผสาน (Option 1 + 2):**
1. **Clean up**: ลบไฟล์ที่ไม่ใช้งานทันที (โฟลเดอร์ `temp`, สคริปต์ที่ใช้ครั้งเดียวทิ้ง)
2. **Contextual Markdown**: วางไฟล์ `ARCHITECTURE.md` สั้นๆ ไว้ใน root, `api/`, `worker/`, `frontend/` เพื่ออธิบายสถาปัตยกรรม (เช่น Frontend ห้าม Hardcode Step นะ ต้องดึงจาก API)
3. **Enforce Type Hints**: ในโค้ด Python และ TypeScript จะใช้ Types อย่างเคร่งครัด เพราะ AI อ่าน Types ได้ดีกว่าการอ่านคู่มือภาษาคน

## Acceptance criteria
1. ลบไฟล์และโฟลเดอร์ที่ไม่จำเป็นทั้งหมดออกจาก Workspace สำเร็จ
2. มีไฟล์ `ARCHITECTURE.md` ประจำโฟลเดอร์หลัก ที่อธิบายหลักการทำงานและกฎ (Rules) ของโฟลเดอร์นั้น
3. โครงสร้างโปรเจกต์สะอาดขึ้น ไฟล์ขยะถูกกำจัด ทำให้ AI สามารถอ่าน Directory Tree ได้รวดเร็ว
