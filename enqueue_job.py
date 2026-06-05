import urllib.request
import json
import sys

# URL ของ API สำหรับสร้าง Job (Create Sync Job)
API_URL = "http://localhost:8000/api/v1/jobs/sync"

# ตัวอย่างข้อมูล Payload สำหรับสร้าง Job ใหม่ (ตาม Schema UserSyncRequest)
PAYLOAD = {
    "document_info": {
        "date": "05/06/2026",
        "doc_no": "MANUAL-JOB-001"
    },
    "requester_info": {
        "company": "AAPICO",
        "name_thai": "สมชาย รักดี",
        "name_english": "Somchai Rakdee",
        "employee_id": "EMP26061",
        "position": "Software Engineer",
        "department_group": "Information Technology",
        "department": "IT Development",
        "ext": "1234",
        "mobile_phone": "081-234-5678",
        "supervisor_name": "Wajeepradit P.",
        "supervisor_position": "IT Manager",
        "address": "99/9 Phranakhon Sri Ayutthaya",
        "zip_code": "13160"
    },
    "custom_username": "somchai.r",      # กำหนด sAMAccountName ที่ต้องการ (ใส่ None เพื่อเจนอัตโนมัติ)
    "custom_print_code": "26061",       # กำหนดรหัสบัตรพิมพ์ PaperCut (ใส่ None เพื่อใช้ Employee ID)
    "is_contractor": False,              # True หากต้องการสร้างใน OU=contract, False สำหรับ OU=newhire
    "target_ou": None,                  # ระบุ Distinguished Name ของ OU ปลายทางเองได้ (ถ้ามี)
    "custom_attributes": {              # (ตัวเลือกเสริม) สำหรับเขียนทับ/ใส่ค่าเพิ่มเติมลงใน ADUC
        "password": "DefaultPassword2026!",
        "change_password_next_logon": True,
        "groups": [                     # ระบุกลุ่ม Security Groups ที่ผู้ใช้รายนี้ต้องการเข้าเป็นสมาชิก
            "Domain Users"
        ]
    }
}

def create_job(url, data_payload):
    print(f"กำลังส่งคำสั่งยิง API ไปที่: {url}...")
    
    # แปลง Payload เป็น JSON byte string
    encoded_data = json.dumps(data_payload).encode("utf-8")
    
    # สร้าง request object
    req = urllib.request.Request(
        url,
        data=encoded_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            response_body = response.read().decode("utf-8")
            
            print(f"\n[สำเร็จ] HTTP Status: {status_code}")
            
            # จัดรูปแบบ JSON เพื่อให้อ่านง่าย
            parsed_res = json.loads(response_body)
            print("Response Data:")
            print(json.dumps(parsed_res, indent=4, ensure_ascii=False))
            
            job_id = parsed_res.get("job_id")
            if job_id:
                print(f"\n💡 คุณสามารถติดตามสถานะของ Job ได้แบบเรียลไทม์ที่:")
                print(f"   http://localhost:8000/api/v1/jobs/{job_id}")
                print(f"   หรือผ่าน Event Stream (SSE):")
                print(f"   http://localhost:8000/api/v1/jobs/{job_id}/stream")
                
    except urllib.error.HTTPError as he:
        print(f"\n[ล้มเหลว] HTTP Error: {he.code} {he.reason}")
        error_body = he.read().decode("utf-8")
        try:
            parsed_err = json.loads(error_body)
            print(json.dumps(parsed_err, indent=4, ensure_ascii=False))
        except Exception:
            print(error_body)
    except Exception as e:
        print(f"\n[ข้อผิดพลาด] ไม่สามารถเชื่อมต่อ API ได้: {e}")

if __name__ == "__main__":
    # รองรับการส่ง URL ผ่าน argument
    target_url = sys.argv[1] if len(sys.argv) > 1 else API_URL
    create_job(target_url, PAYLOAD)
