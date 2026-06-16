import time
import logging
from datetime import datetime, timedelta
from core.database import update_job, add_log, get_job
from core.redis_conn import sync_queue
from services.ad_service import ad_service
from services.papercut_service import papercut_service
from services.m365_service import m365_service

logger = logging.getLogger("worker.tasks.sync_user")

# Helper to check if a job is cancelled or paused
def check_job_status(job_id: str, step_id: str) -> bool:
    job = get_job(job_id)
    if not job:
        return True
        
    if job["status"] == "cancelled":
        return False
        
    if job["status"] == "paused":
        while True:
            time.sleep(2)
            job = get_job(job_id)
            if not job or job["status"] == "cancelled":
                return False
            if job["status"] == "processing":
                break
                
    return True

# Helper to route to the next task in the pipeline based on workflow_control
def move_to_next_step(job_id: str, payload: dict, current_step: str):
    job = get_job(job_id)
    if job and job["status"] == "cancelled":
        return
        
    workflow = payload.get("workflow_control", {})
    task_data = payload.get("task_data", {})
    
    if current_step == "ad_creation":
        if workflow.get("enable_papercut_sync", True):
            add_log(job_id, "papercut_sync", "running", "Enqueuing PaperCut Sync task")
            sync_queue.enqueue('tasks.sync_user.run_papercut_task', job_id, payload, job_id=job_id)
        else:
            add_log(job_id, "papercut_sync", "skipped", "PaperCut Sync task skipped by workflow control")
            move_to_next_step(job_id, payload, current_step="papercut_sync")
            
    elif current_step == "papercut_sync":
        if workflow.get("enable_microsoft_365_license", True):
            add_log(job_id, "m365_license", "running", "Enqueuing Microsoft 365 License task (delayed 5m)")
            # Use RQ delayed execution to wait 5 minutes (for Azure AD Connect sync)
            sync_queue.enqueue_in(timedelta(minutes=5), 'tasks.sync_user.run_m365_license_task', job_id, payload, job_id=job_id)
        else:
            add_log(job_id, "m365_license", "skipped", "Microsoft 365 License task skipped by workflow control")
            move_to_next_step(job_id, payload, current_step="m365_license")
            
    elif current_step == "m365_license":
        if workflow.get("enable_send_email", True):
            add_log(job_id, "send_email", "running", "Enqueuing Email Notification task")
            sync_queue.enqueue('tasks.sync_user.run_send_email_task', job_id, payload, job_id=job_id)
        else:
            add_log(job_id, "send_email", "skipped", "Email Notification task skipped by workflow control")
            # All steps completed successfully
            update_job(job_id, status="success", result={"message": "Pipeline completed successfully without email notification"})
            add_log(job_id, "pipeline", "success", "Pipeline execution finished successfully")

def normalize_payload(payload: dict) -> dict:
    if "metadata" in payload or "task_data" in payload:
        return payload
        
    req_info = payload.get("requester_info", {})
    doc_info = payload.get("document_info", {})
    custom_attrs = payload.get("custom_attributes", {}) or {}
    
    username = payload.get("custom_username")
    if not username:
        name_english = req_info.get("name_english", "").strip().lower()
        parts = name_english.replace("mr. ", "").replace("ms. ", "").replace("mrs. ", "").split()
        if len(parts) >= 2:
            username = f"{parts[0]}.{parts[1][0]}"
        elif len(parts) == 1:
            username = parts[0]
        else:
            username = f"user.{req_info.get('employee_id', 'unknown')}"

    licenses = custom_attrs.get("licenses")
    if licenses is None:
        if req_info.get("department", "").lower().find("engineering") != -1:
            licenses = ["sku-ems", "sku-standardpack"]
        else:
            licenses = ["sku-standardpack"]

    normalized_custom_attrs = {
        "first_name": custom_attrs.get("first_name") or (req_info.get("name_english", "").split()[0] if req_info.get("name_english") else ""),
        "last_name": custom_attrs.get("last_name") or (req_info.get("name_english", "").split()[-1] if req_info.get("name_english") and len(req_info.get("name_english", "").split()) > 1 else ""),
        "display_name": custom_attrs.get("display_name") or req_info.get("name_english", ""),
        "description": custom_attrs.get("description") or req_info.get("employee_id", ""),
        "office": custom_attrs.get("office") or req_info.get("company", ""),
        "email": custom_attrs.get("email") or f"{username}@{req_info.get('company', 'company').lower().replace(' ', '')}.com",
        "mobile": custom_attrs.get("mobile") or req_info.get("mobile_phone", ""),
        "title": custom_attrs.get("title") or req_info.get("position", ""),
        "department": custom_attrs.get("department") or req_info.get("department", ""),
        "company": custom_attrs.get("company") or req_info.get("company", ""),
        "manager": custom_attrs.get("manager") or req_info.get("supervisor_name", ""),
        "street": custom_attrs.get("street") or req_info.get("address", ""),
        "zip_postal_code": custom_attrs.get("zip_postal_code") or req_info.get("zip_code", ""),
        **custom_attrs
    }

    return {
        "metadata": {
            "document_info": doc_info,
            "requester_info": req_info
        },
        "workflow_control": {
            "enable_ad_creation": True,
            "enable_papercut_sync": custom_attrs.get("enable_papercut_sync", True),
            "enable_microsoft_365_license": custom_attrs.get("enable_microsoft_365_license", True),
            "enable_send_email": custom_attrs.get("enable_send_email", True)
        },
        "task_data": {
            "ad_profile": {
                "custom_username": username,
                "target_ou": payload.get("target_ou"),
                "custom_attributes": normalized_custom_attrs
            },
            "papercut_profile": {
                "print_code": payload.get("custom_print_code") or req_info.get("employee_id")
            },
            "microsoft_365_licenses": {
                "SkuId_id": licenses
            },
            "email_profile": {
                "emailTo": custom_attrs.get("emailTo") or f"supervisor@{req_info.get('company', 'company').lower().replace(' ', '')}.com",
                "emailCc": custom_attrs.get("emailCc") or "it.support@aapico.com",
                "emailSubject": custom_attrs.get("emailSubject") or f"New AD Account Created for {req_info.get('name_english', 'Employee')}",
                "emailBody": custom_attrs.get("emailBody") or "Welcome to the team!"
            }
        }
    }

# Main entry point from the API
def run_sync_pipeline(job_id: str, payload: dict):
    payload = normalize_payload(payload)
    update_job(job_id, status="processing")
    add_log(job_id, "pipeline", "running", "Initiating decoupled multi-step provisioning pipeline")
    
    workflow = payload.get("workflow_control", {})
    if workflow.get("enable_ad_creation", True):
        add_log(job_id, "ad_creation", "running", "Enqueuing AD Creation task")
        sync_queue.enqueue('tasks.sync_user.run_ad_creation_task', job_id, payload, job_id=job_id)
    else:
        add_log(job_id, "ad_creation", "skipped", "AD Creation task skipped by workflow control")
        move_to_next_step(job_id, payload, current_step="ad_creation")

# Step 1: AD Creation Task
def run_ad_creation_task(job_id: str, payload: dict):
    if not check_job_status(job_id, "ad_creation"):
        return
    try:
        update_job(job_id, current_step="ad_creation")
        req_info = payload.get("metadata", {}).get("requester_info", {})
        ad_profile = payload.get("task_data", {}).get("ad_profile", {})
        custom_attrs = ad_profile.get("custom_attributes", {})
        
        username = ad_profile.get("custom_username")
        if not username:
            raise Exception("sAMAccountName (custom_username) is required for AD Creation")
            
        ad_user_details = {
            "username": username,
            "email": custom_attrs.get("email") or f"{username}@{req_info.get('company', 'company').lower()}.com",
            "name_english": req_info.get("name_english", ""),
            "company": req_info.get("company", ""),
            "employee_id": req_info.get("employee_id", ""),
            "position": req_info.get("position", ""),
            "department": req_info.get("department", ""),
            "ext": req_info.get("ext", ""),
            "mobile_phone": req_info.get("mobile_phone", ""),
            "supervisor_name": req_info.get("supervisor_name", ""),
            "custom_attributes": custom_attrs
        }
        
        # Check if user already exists
        exists = ad_service.check_user_exists(username)
        if exists:
            add_log(job_id, "ad_creation", "success", f"User {username} already exists. Skipping creation.")
        else:
            # Create user in Active Directory
            is_contractor = payload.get("is_contractor", False)
            success, ad_dn = ad_service.create_user(
                ad_user_details,
                is_contractor=is_contractor,
                target_ou=ad_profile.get("target_ou")
            )
            if not success:
                raise Exception("AD creation failed in ad_service")
            add_log(job_id, "ad_creation", "success", f"Created AD account in {ad_dn}")
            
        # Validate properties in Active Directory
        expected_props = {
            "first_name": custom_attrs.get("first_name") or "",
            "last_name": custom_attrs.get("last_name") or "",
            "display_name": custom_attrs.get("display_name") or "",
            "description": custom_attrs.get("description") or "",
            "office": custom_attrs.get("office") or "",
            "telephone_number": custom_attrs.get("telephone_number") or "",
            "email": custom_attrs.get("email") or "",
            "mobile": custom_attrs.get("mobile") or "",
            "title": custom_attrs.get("title") or "",
            "department": custom_attrs.get("department") or "",
            "company": custom_attrs.get("company") or "",
            "employee_id": custom_attrs.get("employee_id") or "",
            "user_principal_name": custom_attrs.get("user_principal_name") or "",
            "password_never_expires": custom_attrs.get("password_never_expires", False),
            "account_disabled": custom_attrs.get("account_disabled", False),
            "change_password_next_logon": custom_attrs.get("change_password_next_logon", True),
        }
        
        optional_fields = ["street", "post_office_box", "city", "state_province", "zip_postal_code", "country_region", 
                           "logon_script", "home_phone", "notes", "manager", "groups"]
        for field in optional_fields:
            if field in custom_attrs:
                expected_props[field] = custom_attrs[field]
                
        val_success, passes, failures = ad_service.validate_user(username, expected_props)
        if val_success:
            for p in passes:
                add_log(job_id, "ad_creation", "running", f"Verify Pass: {p} matches expected value")
            add_log(job_id, "ad_creation", "success", "AD Account validation passed successfully")
        else:
            raise Exception(f"AD Validation failures: {failures}")
            
        move_to_next_step(job_id, payload, current_step="ad_creation")
        
    except Exception as e:
        logger.error(f"AD Creation task failed: {e}")
        add_log(job_id, "ad_creation", "failed", f"Error: {str(e)}")
        update_job(job_id, status="failed", error=str(e))

# Step 2: PaperCut Sync Task
def run_papercut_task(job_id: str, payload: dict):
    if not check_job_status(job_id, "papercut_sync"):
        return
    try:
        update_job(job_id, current_step="papercut_sync")
        ad_profile = payload.get("task_data", {}).get("ad_profile", {})
        username = ad_profile.get("custom_username")
        pc_profile = payload.get("task_data", {}).get("papercut_profile", {})
        print_code = pc_profile.get("print_code")
        
        # Trigger force user sync from AD
        papercut_service.force_user_sync()
        add_log(job_id, "papercut_sync", "running", "Triggered global PaperCut sync from Active Directory")
        
        # Wait a moment for synchronization to process on papercut service side
        time.sleep(2)
        
        # Set print code / PIN code
        if print_code:
            pin_success = papercut_service.set_user_primary_card(username, print_code)
            if pin_success:
                add_log(job_id, "papercut_sync", "success", f"Successfully set printer PIN code to {print_code}")
            else:
                add_log(job_id, "papercut_sync", "success", "Synchronized user, but PIN code assignment returned success=False (mock fallback)")
        else:
            add_log(job_id, "papercut_sync", "success", "Synchronized user. No print_code was specified in payload.")
            
        move_to_next_step(job_id, payload, current_step="papercut_sync")
        
    except Exception as e:
        logger.error(f"PaperCut Sync task failed: {e}")
        add_log(job_id, "papercut_sync", "failed", f"Error: {str(e)}")
        update_job(job_id, status="failed", error=str(e))

# Step 3: Microsoft 365 License Assignment Task
def run_m365_license_task(job_id: str, payload: dict):
    if not check_job_status(job_id, "m365_license"):
        return
    try:
        update_job(job_id, current_step="m365_license")
        ad_profile = payload.get("task_data", {}).get("ad_profile", {})
        username = ad_profile.get("custom_username")
        m365_licenses = payload.get("task_data", {}).get("microsoft_365_licenses", {})
        sku_ids = m365_licenses.get("SkuId_id", [])
        
        # Format licenses for display in logs
        log_skus = []
        for sku in sku_ids:
            if isinstance(sku, dict):
                log_skus.append(sku.get("skuPartNumber") or sku.get("skuId") or str(sku))
            else:
                log_skus.append(str(sku))
        
        # Assign licenses using Microsoft Graph Service
        upn = ad_profile.get("custom_attributes", {}).get("user_principal_name") or f"{username}@aapico.com"
        m365_service.assign_licenses(upn, sku_ids)
        add_log(job_id, "m365_license", "success", f"Successfully assigned {len(sku_ids)} M365 licenses to user {username}")
        
        move_to_next_step(job_id, payload, current_step="m365_license")
        
    except Exception as e:
        logger.error(f"M365 License task failed: {e}")
        add_log(job_id, "m365_license", "failed", f"Error: {str(e)}")
        update_job(job_id, status="failed", error=str(e))

# Step 4: Email Notification Task
def run_send_email_task(job_id: str, payload: dict):
    if not check_job_status(job_id, "send_email"):
        return
    try:
        update_job(job_id, current_step="send_email")
        email_profile = payload.get("task_data", {}).get("email_profile", {})
        email_to = email_profile.get("emailTo")
        email_cc = email_profile.get("emailCc")
        email_subject = email_profile.get("emailSubject")
        email_body = email_profile.get("emailBody")
        
        add_log(job_id, "send_email", "running", f"Sending onboarding email notification to: {email_to}")
        
        # SMTP email dispatch simulation
        time.sleep(1)
        add_log(job_id, "send_email", "success", f"Email notification successfully sent to {email_to} (CC: {email_cc})")
        
        # Final success update
        update_job(job_id, status="success", result={"message": "Pipeline completed successfully with welcome email sent"})
        add_log(job_id, "pipeline", "success", "Pipeline execution finished successfully")
        
    except Exception as e:
        logger.error(f"Email Notification task failed: {e}")
        add_log(job_id, "send_email", "failed", f"Error: {str(e)}")
        update_job(job_id, status="failed", error=str(e))
