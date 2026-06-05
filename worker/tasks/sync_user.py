from .pipeline import run_pipeline
# pyrefly: ignore [missing-import]
from services.ad_service import ad_service
# pyrefly: ignore [missing-import]
from services.papercut_service import papercut_service
import time

def init_context(payload: dict) -> dict:
    req_info = payload.get("requester_info", {})
    username = payload.get("custom_username")
    
    if not username:
        clean_name = req_info.get("name_english", "").replace("Mr. ", "").replace("Ms. ", "").replace("Mrs. ", "").strip().lower()
        parts = clean_name.split()
        if len(parts) >= 2:
            username = f"{parts[0]}.{parts[1][0]}"
        elif len(parts) == 1:
            username = parts[0]
        else:
            username = f"user.{req_info.get('employee_id', '0000')}"
            
    print_code = payload.get("custom_print_code") or req_info.get("employee_id", "")
            
    ad_user_details = {
        "username": username,
        "email": f"{username}@{req_info.get('company', 'company').lower()}.com",
        "name_english": req_info.get("name_english", ""),
        "company": req_info.get("company", ""),
        "employee_id": req_info.get("employee_id", ""),
        "position": req_info.get("position", ""),
        "department": req_info.get("department", ""),
        "ext": req_info.get("ext", ""),
        "mobile_phone": req_info.get("mobile_phone", ""),
        "supervisor_name": req_info.get("supervisor_name", ""),
        "custom_attributes": payload.get("custom_attributes") or {}
    }
    
    return {
        "username": username,
        "print_code": print_code,
        "ad_user_details": ad_user_details,
        "ad_created": False,
        "final_result": {}
    }

def step_ad_check(job_id: str, payload: dict, context: dict):
    exists = ad_service.check_user_exists(context["username"])
    if exists:
        context["ad_status"] = "Exists"
        return {"status": "success", "message": f"User {context['username']} already exists"}
    
    context["ad_status"] = "Not Found"
    return {"status": "success", "message": f"User {context['username']} not found. Will create."}

def step_ad_create(job_id: str, payload: dict, context: dict):
    if context.get("ad_status") == "Exists":
        target_ou = payload.get("target_ou") or ("OU=contract" if payload.get("is_contractor") else "OU=newhire")
        context["final_result"]["active_directory"] = {
            "status": "Exists (Checked)",
            "distinguished_name": f"CN={context['ad_user_details']['name_english']},{target_ou}"
        }
        return {"status": "success", "message": "Skipped creation (already exists)"}
        
    success, ad_dn = ad_service.create_user(
        context["ad_user_details"], 
        is_contractor=payload.get("is_contractor", False),
        target_ou=payload.get("target_ou")
    )
    
    if success:
        context["ad_created"] = True
        context["final_result"]["active_directory"] = {
            "status": "Success",
            "distinguished_name": ad_dn
        }
        return {"status": "success", "message": f"Created AD account in {ad_dn}"}
    else:
        raise Exception("Failed to create AD account")

def step_pc_sync(job_id: str, payload: dict, context: dict):
    try:
        # Sleep for a moment to let AD replicate if needed
        time.sleep(2)
        
        # We don't have sync_user_from_ad in papercut_service currently in the code you showed me,
        # but you had papercut_service.sync_user_from_ad(username) in user.py before.
        # So I will assume we should use force_user_sync() as per papercut_service.py logic.
        papercut_service.force_user_sync()
        return {"status": "success", "message": f"Triggered global PaperCut sync"}
    except Exception as e:
        return {"status": "failed", "message": f"Failed to sync Papercut: {e}"}

def step_pc_pin(job_id: str, payload: dict, context: dict):
    try:
        # Sleep to allow force sync to pick up the new user
        time.sleep(2)
        pin_success = papercut_service.set_user_primary_card(context["username"], context["print_code"])
        context["final_result"]["papercut"] = {
            "status": "Success" if pin_success else "No Code Set"
        }
        return {"status": "success", "message": f"Set PIN code {context['print_code']} successfully"}
    except Exception as e:
        context["final_result"]["papercut"] = {
            "status": f"Failed: {str(e)}"
        }
        return {"status": "failed", "message": f"Failed to set PIN: {e}"}

# Define workflow steps
WORKFLOW_STEPS = [
    {"id": "ad_check", "func": step_ad_check, "name": "Check Active Directory"},
    {"id": "ad_create", "func": step_ad_create, "name": "Create AD Account"},
    {"id": "pc_sync", "func": step_pc_sync, "name": "Sync PaperCut Data"},
    {"id": "pc_pin", "func": step_pc_pin, "name": "Set Printer PIN"},
]

def run_sync_pipeline(job_id: str, payload: dict):
    run_pipeline(job_id, payload, WORKFLOW_STEPS, init_context)
