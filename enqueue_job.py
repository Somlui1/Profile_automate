import urllib.request
import json
import sys
import time

# กำหนดเซิร์ฟเวอร์ปลายทางตามคำสั่ง
SERVER_HOST = "10.10.3.215:8000"
API_URL = f"http://{SERVER_HOST}/api/v1/jobs/sync"

# Payload ข้อมูลพนักงานและ AD Properties ตามฟังก์ชัน create_aduc_field_validation_user() ใน temp/AD.py
PAYLOAD = {
    "document_info": {
        "date": "05/06/2026",
        "doc_no": "TEST-ADUC-FIELD-VALIDATION"
    },
    "requester_info": {
        "company": "AH",
        "name_thai": "AducField Tester",
        "name_english": "AducField Tester (AH-Test)",
        "employee_id": "99999999",  # เลขตองระบุตัวตนระบบทดสอบ
        "position": "QA Automation Tester",
        "department_group": "IT Infrastructure Quality Control",
        "department": "IT Infrastructure Quality Control",
        "ext": "9999",
        "mobile_phone": "089-999-9999",
        "supervisor_name": "Witthaya Treeklee",
        "supervisor_position": "Department Manager",
        "address": "99/9 Active Directory Validation Road",
        "zip_code": "13160"
    },
    "custom_username": "aduc.test",             # sAMAccountName ที่ต้องการทดสอบ
    "custom_print_code": "999999",              # รหัส PIN บัตรเครื่องพิมพ์ PaperCut
    "is_contractor": False,                     # OU=newhire
    "target_ou": "OU=IT,OU=AH,DC=aapico,DC=com", # OU ปลายทางที่ต้องการบันทึกผู้ใช้
    "custom_attributes": {
        # 1. General Tab
        "first_name": "AducField",
        "last_name": "Tester",
        "display_name": "AducField Tester (AH-Test)",
        "description": "99999999",
        "office": "AH_Test_Lab",
        "telephone_number": "035-350880 ext.9999",
        "email": "aduc.test@aapico.com",
        "web_page": "https://www.aapico.com",

        # 2. Address Tab
        "street": "99/9 Active Directory Validation Road",
        "post_office_box": "BOX-999",
        "city": "Bang pa-in",
        "state_province": "Phranakhon Sri Ayutthaya",
        "zip_postal_code": "13160",
        "country_region": "Thailand",

        # 3. Account Tab (ตั้งค่าบัญชี & UAC)
        "user_principal_name": "aduc.test@aapico.com",
        "password_never_expires": False,
        "account_disabled": False,
        "smartcard_required": False,
        "change_password_next_logon": True,   # บังคับเปลี่ยนรหัสผ่านในครั้งถัดไป
        "password": "AducTestPassword2026!",   # รหัสผ่านเบื้องต้น

        # 4. Profile Tab
        "logon_script": "IT_AH_TEST.bat",

        # 5. Telephones Tab
        "home_phone": "02-000-0000",
        "mobile": "089-999-9999",
        "notes": "SYSTEM TEST: This account is dedicated to validating Python ldap3 attribute mapping against Active Directory Users and Computers (ADUC) interface tabs.",

        # 6. Organization Tab
        "title": "QA Automation Tester",
        "department": "IT Infrastructure Quality Control",
        "company": "AH",
        "manager": "Witthaya Treeklee",        # ชื่อผู้จัดการเพื่อดึง DN มาผูก

        # 7. Member Of
        "groups": [
            "AH IT",
            "CL200",
            "AAPICO Group VPN",
            "AH IT Infrastructure",
            "AAPICO Social App",
            "AAPICO Allow USB",
            "User_LevelB (AH)"
        ]
    }
}

def stream_job_updates(job_id, server_host):
    """
    เชื่อมต่อ SSE Stream เพื่อเฝ้าดูและติดตามการทำงานของ API & Worker แบบเรียลไทม์
    เพื่อตรวจสอบความถูกต้องว่าฝั่ง API และ Worker สื่อสารกันได้ดี
    """
    stream_url = f"http://{server_host}/api/v1/jobs/{job_id}/stream"
    print(f"\n📡 เชื่อมต่อเข้าสู่ SSE Stream เพื่อตรวจสอบการทำงานของระบบแบบ Real-time...")
    print(f"Stream URL: {stream_url}\n")
    
    req = urllib.request.Request(stream_url, method="GET")
    try:
        # เปิดการรับส่งข้อมูลแบบ Stream ของ HTTP
        with urllib.request.urlopen(req) as response:
            for line in response:
                line_decoded = line.decode("utf-8").strip()
                if not line_decoded:
                    continue
                
                # ดึง Event และ JSON data มาแสดงผล
                if line_decoded.startswith("event:"):
                    event_type = line_decoded.replace("event:", "").strip()
                    print(f"🔔 [{event_type.upper()}]", end=" -> ")
                elif line_decoded.startswith("data:"):
                    data_str = line_decoded.replace("data:", "").strip()
                    try:
                        data_json = json.loads(data_str)
                        if "message" in data_json:
                            # เป็นการอัปเดตขั้นตอนย่อยจาก Worker
                            print(f"{data_json.get('message')}")
                        else:
                            # เป็นการรายงานสถานะสุดท้ายของ Job
                            print(f"\n✨ Job Complete!")
                            print(json.dumps(data_json, indent=4, ensure_ascii=False))
                    except Exception:
                        print(data_str)
    except Exception as e:
        print(f"\n⚠️ การ Stream สถานะขัดข้องหรือจบการทำงาน: {e}")

def create_job(url, data_payload, server_host):
    print(f"กำลังส่งคำสั่งยิงสร้าง Job ไปที่ API: {url}...")
    
    encoded_data = json.dumps(data_payload).encode("utf-8")
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
            
            parsed_res = json.loads(response_body)
            print("Response Data:")
            print(json.dumps(parsed_res, indent=4, ensure_ascii=False))
            
            job_id = parsed_res.get("job_id")
            if job_id:
                # เข้าสู่ลูป Stream ดึงสถานะ
                stream_job_updates(job_id, server_host)
                
    except urllib.error.HTTPError as he:
        print(f"\n[ล้มเหลว] HTTP Error: {he.code} {he.reason}")
        error_body = he.read().decode("utf-8")
        try:
            parsed_err = json.loads(error_body)
            print(json.dumps(parsed_err, indent=4, ensure_ascii=False))
        except Exception:
            print(error_body)
    except Exception as e:
        print(f"\n[ข้อผิดพลาด] ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ API ได้: {e}")

if __name__ == "__main__":
    # อนุญาตให้ส่งไอพีหรือโฮสต์อื่นทาง Argument ได้
    target_host = sys.argv[1] if len(sys.argv) > 1 else SERVER_HOST
    target_url = f"http://{target_host}/api/v1/jobs/sync"
    
    create_job(target_url, PAYLOAD, target_host)
