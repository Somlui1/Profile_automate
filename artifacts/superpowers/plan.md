# 📝 Implementation Plan: JobQueueTab Sub-steps Rendering

## Goal
ปรับปรุงคอมโพเนนต์ `JobQueueTab.tsx` ในฝั่ง Frontend เพื่อนำการแสดงผล Sub-steps กลับมาแสดงบน UI และปรับข้อความ/โครงสร้างให้สอดคล้องกับ `worker/workspace.md` โดยจะไม่ทำการแก้ไข Backend/Database และใช้ข้อมูล log เดิมในการจับคู่ (Map) สถานะของ Sub-steps

## Assumptions
- โครงสร้างของข้อมูลจาก Database Log ที่ได้จาก API ยังคงส่ง `metadata.sub_step` และ `metadata.sub_step_status` กลับมาเหมือนเดิม
- ปัญหาปัจจุบันคือ ฟังก์ชันการดึงค่า API `fetchSteps` ถูกแก้ไขผิดพลาด (`Array.isArray(data)` ทำให้ไม่ได้ดึงข้อมูล schema มาใช้) รวมทั้งบล็อกโค้ดสำหรับแสดงผล Sub-steps ถูกลบไป
- การแก้ไขจะทำเฉพาะไฟล์ `frontend/src/components/JobQueueTab.tsx` ไฟล์เดียว

## Plan

### Step 1: Fix Schema Fetching and Default State
- **Files**: `frontend/src/components/JobQueueTab.tsx`
- **Change**: 
  - แก้ไขฟังก์ชัน `fetchSteps` ให้อ่านค่า `data.steps` แทนที่จะเช็ค `Array.isArray(data)`
  - ปรับค่าเริ่มต้น (Initial State) ของ `stepsSchema` ให้มี `sub_steps` ที่สอดคล้องกับ `worker/workspace.md` เพื่อใช้เป็น Fallback ได้ทันที

### Step 2: Restore Sub-steps Logic & Rendering
- **Files**: `frontend/src/components/JobQueueTab.tsx`
- **Change**: 
  - เพิ่มโค้ดที่ใช้ดึงสถานะ Sub-step จาก log `jobLogsCache` เช่น `subStates[log.metadata.sub_step] = log.metadata.sub_step_status.toUpperCase()` กลับเข้ามาในลูปเรนเดอร์ของ Log panel
  - เพิ่ม UI (JSX) ในการเรนเดอร์ `<div className="mb-3 p-2.5 bg-white ...">` เพื่อแสดงจุดไข่ปลา (Dots) และชื่อของแต่ละ Sub-step สำหรับแต่ละขั้นตอนหลัก
- **Verify**: รัน `npm run build` และ `npx tsc --noEmit` ที่โฟลเดอร์ frontend เพื่อให้แน่ใจว่าไม่มี Type error และคอมไพล์ผ่าน

## Risks & mitigations
- *ความเสี่ยง*: ชื่อ `key` ของ `sub_steps` ที่ Backend ส่งมาทาง metadata อาจจะไม่ตรงกับที่ระบุใน State
- *วิธีป้องกัน*: จะยังคงใช้ `key` ตามระบบเดิม แต่ปรับปรุงข้อความ `display_name` ให้ตรงกับความหมายใน `workspace.md` มากที่สุดเพื่อลดผลกระทบของการ Mapping

## Rollback plan
- ใช้คำสั่ง `git checkout HEAD frontend/src/components/JobQueueTab.tsx` เพื่อย้อนโค้ดกลับไปก่อนการแก้ไข
