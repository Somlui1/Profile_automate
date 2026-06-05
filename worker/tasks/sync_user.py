from .pipeline import run_pipeline
# pyrefly: ignore [missing-import]
from services.ad_service import ad_service
# pyrefly: ignore [missing-import]
from services.papercut_service import papercut_service
import time
import logging

logger = logging.getLogger("worker.tasks.sync_user")

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

def step_ad_validate(job_id: str, payload: dict, context: dict):
    username = context["username"]
    custom_attrs = context["ad_user_details"].get("custom_attributes") or {}
    
    # Construct expected properties based on context and custom attributes
    expected_props = {
        "first_name": custom_attrs.get("first_name") or (context["ad_user_details"].get("name_english", "").split()[0] if context["ad_user_details"].get("name_english") else ""),
        "last_name": custom_attrs.get("last_name") or (" ".join(context["ad_user_details"].get("name_english", "").split()[1:]) if len(context["ad_user_details"].get("name_english", "").split()) > 1 else ""),
        "display_name": custom_attrs.get("display_name") or (f"{context['ad_user_details']['name_english']} ({context['ad_user_details']['company']})" if context['ad_user_details']['company'] else context['ad_user_details']['name_english']),
        "description": custom_attrs.get("description") or context["ad_user_details"].get("employee_id"),
        "office": custom_attrs.get("office") or context["ad_user_details"].get("company"),
        "telephone_number": custom_attrs.get("telephone_number") or (f"035-350880 ext.{context['ad_user_details']['ext']}" if context['ad_user_details']['ext'] else ""),
        "email": custom_attrs.get("email") or f"{username}@{context['ad_user_details']['company'].lower() if context['ad_user_details']['company'] else 'company'}.com",
        "mobile": custom_attrs.get("mobile") or context["ad_user_details"].get("mobile_phone"),
        "title": custom_attrs.get("title") or context["ad_user_details"].get("position"),
        "department": custom_attrs.get("department") or context["ad_user_details"].get("department"),
        "company": custom_attrs.get("company") or context["ad_user_details"].get("company"),
        "employee_id": custom_attrs.get("employee_id") or context["ad_user_details"].get("employee_id"),
        "user_principal_name": custom_attrs.get("user_principal_name") or f"{username}@aapico.com",
        "password_never_expires": custom_attrs.get("password_never_expires", False),
        "account_disabled": custom_attrs.get("account_disabled", False),
        "change_password_next_logon": custom_attrs.get("change_password_next_logon", True),
    }
    
    optional_fields = ["street", "post_office_box", "city", "state_province", "zip_postal_code", "country_region", 
                       "logon_script", "home_phone", "notes", "manager", "groups"]
    for field in optional_fields:
        if field in custom_attrs:
            expected_props[field] = custom_attrs[field]
            
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(1, max_retries + 1):
        try:
            success, passes, failures = ad_service.validate_user(username, expected_props)
            if success:
                from core.database import add_log
                for p in passes:
                    add_log(job_id, "ad_validate", "running", f"Verify Pass: {p} matches expected value")
                return {"status": "success", "message": f"AD Account validation passed successfully. All {len(passes)} attributes match."}
            else:
                msg = f"AD validation failed on attempt {attempt}/{max_retries}: {', '.join(failures)}"
                logger.warning(msg)
                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    raise Exception(f"AD Account validation failed after {max_retries} attempts. Errors: {failures}")
        except Exception as e:
            logger.warning(f"AD validation error on attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                time.sleep(retry_delay)
            else:
                raise e

def step_pc_sync(job_id: str, payload: dict, context: dict):
    try:
        # Sleep for a moment to let AD replicate if needed
        time.sleep(2)
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
    {"id": "ad_validate", "func": step_ad_validate, "name": "Validate AD Account"},
    {"id": "pc_sync", "func": step_pc_sync, "name": "Sync PaperCut Data"},
    {"id": "pc_pin", "func": step_pc_pin, "name": "Set Printer PIN"},
]

def run_sync_pipeline(job_id: str, payload: dict):
    run_pipeline(job_id, payload, WORKFLOW_STEPS, init_context)
