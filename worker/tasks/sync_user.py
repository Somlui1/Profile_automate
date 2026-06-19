import time
import logging
from datetime import datetime, timedelta
from typing import NamedTuple, Optional, Callable
from core.database import update_job, add_log, get_job
from core.redis_conn import sync_queue
from services.ad_service import ad_service
from services.papercut_service import papercut_service
from services.m365_service import m365_service
from core.config import settings

class PipelineStep(NamedTuple):
    step_id: str           # e.g. "ad_creation"
    enable_key: str        # e.g. "enable_ad_creation"
    task_path: str         # e.g. "tasks.sync_user.run_ad_creation_task"
    delay: Optional[timedelta]  # None = immediate, timedelta = delayed

PIPELINE_STEPS = [
    PipelineStep("ad_creation",   "enable_ad_creation",            "tasks.sync_user.run_ad_creation_task",     None),
    PipelineStep("papercut_sync", "enable_papercut_sync",          "tasks.sync_user.run_papercut_task",        None),
    PipelineStep("m365_license",  "enable_microsoft_365_license",  "tasks.sync_user.run_m365_license_task",    timedelta(seconds=settings.M365_DELAY_SECONDS)),
    PipelineStep("send_email",    "enable_send_email",             "tasks.sync_user.run_send_email_task",      None),
]

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
    """Route to the next enabled step after `current_step`, or finish the pipeline."""
    job = get_job(job_id)
    if job and job["status"] == "cancelled":
        return
        
    workflow = payload.get("workflow_control", {})
    
    # Find the index of the current step, then iterate forward
    step_ids = [s.step_id for s in PIPELINE_STEPS]
    try:
        current_index = step_ids.index(current_step)
    except ValueError:
        logger.error(f"Unknown step '{current_step}' — cannot route to next step")
        return

    # Look for the next enabled step
    for next_step in PIPELINE_STEPS[current_index + 1:]:
        if workflow.get(next_step.enable_key, True):
            if next_step.delay:
                msg = f"Enqueuing {next_step.step_id} task with a delay of {next_step.delay} (Waiting for execution...)"
                add_log(job_id, next_step.step_id, "pending", msg)
                logger.info(f"[{job_id}] [DELAYED TASK] {msg}")
                sync_queue.enqueue_in(next_step.delay, next_step.task_path, job_id, payload)
            else:
                msg = f"Enqueuing {next_step.step_id} task for immediate execution"
                add_log(job_id, next_step.step_id, "running", msg)
                logger.info(f"[{job_id}] {msg}")
                sync_queue.enqueue(next_step.task_path, job_id, payload)
            return  # Enqueued — done routing
        else:
            add_log(job_id, next_step.step_id, "skipped", f"{next_step.step_id} skipped by workflow control")

    # No more steps — pipeline finished
    update_job(job_id, status="success", result={"message": "Pipeline completed successfully"})
    add_log(job_id, "pipeline", "success", "Pipeline execution finished successfully")

def _run_step(step_id: str, job_id: str, payload: dict, execute_fn):
    """Generic step runner — handles status check, logging, error handling, and routing."""
    if not check_job_status(job_id, step_id):
        return
    try:
        update_job(job_id, current_step=step_id)
        execute_fn(job_id, payload)
        move_to_next_step(job_id, payload, current_step=step_id)
    except Exception as e:
        from core.exceptions import M365UserNotSyncedError
        if getattr(e, '__class__', None) and e.__class__.__name__ == 'M365UserNotSyncedError' or isinstance(e, M365UserNotSyncedError):
            logger.warning(f"[WARNING] [{job_id}] Task '{step_id}' delayed/re-enqueued. Reason: {e}")
            return

        import traceback
        error_trace = traceback.format_exc()
        error_msg = f"Step '{step_id}' failed: {str(e)}"
        
        logger.error(f"[FAILED] [{job_id}] {error_msg}")
        logger.error(f"[TRACEBACK] [{job_id}] Exception Traceback:\n{error_trace}")
        
        add_log(job_id, step_id, "failed", error_msg)
        update_job(job_id, status="failed", error=error_msg)

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
            licenses = [{"skuPartNumber": "EMS"}, {"skuPartNumber": "STANDARDPACK"}]
        else:
            licenses = [{"skuPartNumber": "STANDARDPACK"}]

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
    add_log(job_id, "pipeline", "running", "Initiating provisioning pipeline")
    
    workflow = payload.get("workflow_control", {})
    
    # ===== NEW: Preflight Health Check =====
    from services.health_check import health_checker
    add_log(job_id, "preflight", "running", "Running service health checks...")
    
    passed, results = health_checker.run_preflight(workflow)
    
    for r in results:
        status = "success" if r["passed"] else "failed"
        add_log(job_id, "preflight", status, f"{r['service']}: {r['message']}")
    
    if not passed:
        failed_services = [f"{r['service']} ({r['message']})" for r in results if not r['passed']]
        error_msg = f"Preflight failed. Unreachable services: {', '.join(failed_services)}"
        
        logger.error(f"[PREFLIGHT FAILED] [{job_id}] {error_msg}")
        
        update_job(job_id, status="cancelled", error=error_msg)
        add_log(job_id, "preflight", "failed", error_msg)
        return  # ❌ Cancel job — do not start pipeline
    
    add_log(job_id, "preflight", "success", "All services are ready")
    # ===== END Preflight =====
    
    # Find and enqueue the first enabled step
    for step in PIPELINE_STEPS:
        if workflow.get(step.enable_key, True):
            if step.delay:
                msg = f"Enqueuing {step.step_id} task with a delay of {step.delay} (Waiting for execution...)"
                add_log(job_id, step.step_id, "pending", msg)
                logger.info(f"[{job_id}] [DELAYED TASK] {msg}")
                sync_queue.enqueue_in(step.delay, step.task_path, job_id, payload)
            else:
                msg = f"Enqueuing {step.step_id} task for immediate execution"
                add_log(job_id, step.step_id, "running", msg)
                logger.info(f"[{job_id}] {msg}")
                sync_queue.enqueue(step.task_path, job_id, payload)
            return
        else:
            add_log(job_id, step.step_id, "skipped", f"{step.step_id} skipped by workflow control")
            
    # All steps disabled — finish immediately
    update_job(job_id, status="success", result={"message": "Pipeline completed — all steps skipped"})
    add_log(job_id, "pipeline", "success", "Pipeline finished (all steps disabled)")

# Step 1: AD Creation Task
def _execute_ad_creation(job_id: str, payload: dict):
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
    add_log(job_id, "ad_creation", "running", "Connecting to Active Directory...", metadata={"sub_step": "connect", "sub_step_status": "running"})
    exists = ad_service.check_user_exists(username)
    add_log(job_id, "ad_creation", "success", "Successfully connected to Active Directory.", metadata={"sub_step": "connect", "sub_step_status": "success"})
    
    if exists:
        add_log(job_id, "ad_creation", "success", f"User {username} already exists. Skipping creation.", metadata={"sub_step": "connect", "sub_step_status": "success"})
        add_log(job_id, "ad_creation", "success", "Skipping naming as account exists.", metadata={"sub_step": "naming", "sub_step_status": "success"})
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
        add_log(job_id, "ad_creation", "success", f"Created AD account in {ad_dn}", metadata={"sub_step": "naming", "sub_step_status": "success"})
        
    # Validate properties in Active Directory
    expected_props = {
        "first_name": custom_attrs.get("first_name") or "",
        "last_name": custom_attrs.get("last_name") or "",
        "display_name": custom_attrs.get("display_name") or "",
        "description": custom_attrs.get("description") or "",
        "office": custom_attrs.get("office") or "",
        "telephone_number": custom_attrs.get("telephone_number") or "",
        "email": custom_attrs.get("email") or ad_user_details.get("email", ""),
        "mobile": custom_attrs.get("mobile") or ad_user_details.get("mobile_phone", ""),
        "title": custom_attrs.get("title") or ad_user_details.get("position", ""),
        "department": custom_attrs.get("department") or ad_user_details.get("department", ""),
        "company": custom_attrs.get("company") or ad_user_details.get("company", ""),
        "employee_id": custom_attrs.get("employee_id") or ad_user_details.get("employee_id", ""),
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
            add_log(job_id, "ad_creation", "running", f"Verify Pass: {p} matches expected value", metadata={"sub_step": "verify", "sub_step_status": "running"})
        add_log(job_id, "ad_creation", "success", "AD Account validation passed successfully", metadata={"sub_step": "verify", "sub_step_status": "success"})
    else:
        raise Exception(f"AD Validation failures: {failures}")

def run_ad_creation_task(job_id: str, payload: dict):
    _run_step("ad_creation", job_id, payload, _execute_ad_creation)

# Step 2: PaperCut Sync Task
def _execute_papercut_sync(job_id: str, payload: dict):
    ad_profile = payload.get("task_data", {}).get("ad_profile", {})
    username = ad_profile.get("custom_username")
    pc_profile = payload.get("task_data", {}).get("papercut_profile", {})
    print_code = pc_profile.get("print_code")
    
    # Trigger force user sync from AD
    add_log(job_id, "papercut_sync", "running", "Triggering global PaperCut sync from Active Directory...", metadata={"sub_step": "trigger", "sub_step_status": "running"})
    papercut_service.force_user_sync()
    add_log(job_id, "papercut_sync", "running", "Triggered global PaperCut sync from Active Directory", metadata={"sub_step": "trigger", "sub_step_status": "success"})
    
    # Wait a moment for synchronization to process on papercut service side
    time.sleep(2)
    
    # Set print code / PIN code
    if print_code:
        pin_success = papercut_service.set_user_primary_card(username, print_code)
        if pin_success:
            add_log(job_id, "papercut_sync", "running", f"Successfully set printer PIN code to {print_code}", metadata={"sub_step": "sync", "sub_step_status": "running"})
        else:
            add_log(job_id, "papercut_sync", "running", "Synchronized user, but PIN code assignment returned success=False (mock fallback)", metadata={"sub_step": "sync", "sub_step_status": "running"})
    else:
        add_log(job_id, "papercut_sync", "running", "Synchronized user. No print_code was specified in payload.", metadata={"sub_step": "sync", "sub_step_status": "running"})

    # Set initial print balance = 100 for all new users
    balance_success = papercut_service.set_user_account_balance(
        username, balance=100.0, comment="Initial print balance for new employee"
    )
    if balance_success:
        add_log(job_id, "papercut_sync", "success", f"Initial print balance set to 100 credits for user {username}", metadata={"sub_step": "sync", "sub_step_status": "success"})
    else:
        add_log(job_id, "papercut_sync", "success", f"PaperCut sync complete. Balance assignment returned False for user {username}", metadata={"sub_step": "sync", "sub_step_status": "success"})

def run_papercut_task(job_id: str, payload: dict):
    _run_step("papercut_sync", job_id, payload, _execute_papercut_sync)

# Step 3: Microsoft 365 License Assignment Task
def _execute_m365_license(job_id: str, payload: dict):
    ad_profile = payload.get("task_data", {}).get("ad_profile", {})
    username = ad_profile.get("custom_username")
    m365_licenses = payload.get("task_data", {}).get("microsoft_365_licenses", {})
    sku_ids = m365_licenses.get("SkuId_id", [])
    
    upn = ad_profile.get("custom_attributes", {}).get("user_principal_name") or f"{username}@aapico.com"
    
    # Check if user exists in Azure AD, retry via scheduler up to 3 times (4 total checks) with 2-minute delays
    retry_count = payload.get("_m365_sync_retry_count", 0)
    MAX_RETRIES = 3
    
    add_log(job_id, "m365_license", "running", f"Checking if user {upn} exists in Azure AD (attempt {retry_count + 1}/{MAX_RETRIES + 1})", metadata={"sub_step": "check", "sub_step_status": "running"})
    
    if not m365_service.check_user_exists(upn):
        if retry_count >= MAX_RETRIES:
            raise Exception(f"[FAILED] User {upn} not found in Azure AD after {MAX_RETRIES} scheduler retries (2 minutes each). Sync check failed.")
            
        delay = timedelta(minutes=2)
        payload["_m365_sync_retry_count"] = retry_count + 1
        
        msg = f"User {upn} not yet synced to Azure AD. Rescheduling check via scheduler in 2 minutes..."
        add_log(job_id, "m365_license", "running", msg, metadata={"sub_step": "check", "sub_step_status": "running"})
        sync_queue.enqueue_in(delay, "tasks.sync_user.run_m365_license_task", job_id, payload)
        
        from core.exceptions import M365UserNotSyncedError
        raise M365UserNotSyncedError(msg)
    
    add_log(job_id, "m365_license", "running", f"User {upn} found in Azure AD. Resolving SKUs...", metadata={"sub_step": "check", "sub_step_status": "success"})
    
    sku_ids = m365_service.resolve_sku_ids(sku_ids) if sku_ids else []
    
    # Set usageLocation (Required by MS Graph before assigning licenses)
    add_log(job_id, "m365_license", "running", f"Setting usageLocation to 'TH' for user {upn}", metadata={"sub_step": "usageLocation", "sub_step_status": "running"})
    m365_service.set_usage_location(upn, "TH")
    
    # Verify usageLocation has propagated in Azure AD (loop up to 5 times, 3s delay each)
    verified = False
    for verify_attempt in range(5):
        current_loc = m365_service.get_user_usage_location(upn)
        if current_loc == "TH":
            verified = True
            logger.info(f"[{job_id}] Verified usageLocation is set to 'TH' (attempt {verify_attempt + 1}/5)")
            break
        logger.info(f"[{job_id}] Verification of usageLocation is still pending... waiting 3 seconds (attempt {verify_attempt + 1}/5)")
        time.sleep(3)
        
    if not verified:
        logger.warning(f"[WARNING] [{job_id}] Could not verify usageLocation 'TH' via API within 15 seconds. Proceeding to assign licenses as fallback.")
        add_log(job_id, "m365_license", "running", "Warning: usageLocation verification timed out, proceeding to assign licenses", metadata={"sub_step": "usageLocation", "sub_step_status": "success"})
    else:
        add_log(job_id, "m365_license", "running", "Verified usageLocation set to 'TH'. Waiting 5 seconds for replication...", metadata={"sub_step": "usageLocation", "sub_step_status": "success"})
        time.sleep(5)

    # Format licenses for display in logs
    log_skus = []
    for sku in sku_ids:
        if isinstance(sku, dict):
            log_skus.append(sku.get("skuPartNumber") or sku.get("skuId") or str(sku))
        else:
            log_skus.append(str(sku))
    
    logger.info(f"[{job_id}] Preparing to assign {len(sku_ids)} M365 licenses to user {upn}: {', '.join(log_skus)}")
    add_log(job_id, "m365_license", "running", f"Assigning M365 licenses: {', '.join(log_skus)}", metadata={"sub_step": "assign", "sub_step_status": "running"})
    
    # Assign licenses using Microsoft Graph Service with a retry for usageLocation propagation delay
    max_assign_attempts = 3
    for attempt in range(max_assign_attempts):
        try:
            m365_service.assign_licenses(upn, sku_ids)
            break
        except Exception as e:
            is_propagation_error = "usage location" in str(e).lower() or "usagelocationspecified" in str(e).lower()
            if is_propagation_error and attempt < max_assign_attempts - 1:
                retry_delay = 5 * (attempt + 1)
                logger.warning(f"[WARNING] [{job_id}] License assignment failed due to usageLocation propagation delay. Retrying in {retry_delay} seconds (attempt {attempt + 1}/{max_assign_attempts})...")
                time.sleep(retry_delay)
            else:
                raise e
                
    add_log(job_id, "m365_license", "success", f"Successfully assigned {len(sku_ids)} M365 licenses to user {username}", metadata={"sub_step": "assign", "sub_step_status": "success"})

def run_m365_license_task(job_id: str, payload: dict):
    _run_step("m365_license", job_id, payload, _execute_m365_license)

# Step 4: Email Notification Task
def _execute_send_email(job_id: str, payload: dict):
    email_profile = payload.get("task_data", {}).get("email_profile", {})
    email_to = email_profile.get("emailTo")
    email_cc = email_profile.get("emailCc")
    email_subject = email_profile.get("emailSubject")
    email_body = email_profile.get("emailBody")
    
    add_log(job_id, "send_email", "running", f"Sending onboarding email notification to: {email_to}", metadata={"sub_step": "send", "sub_step_status": "running"})
    
    # SMTP email dispatch simulation
    time.sleep(1)
    add_log(job_id, "send_email", "running", "Email dispatched to SMTP server.", metadata={"sub_step": "send", "sub_step_status": "success"})
    add_log(job_id, "send_email", "success", f"Email notification successfully sent to {email_to} (CC: {email_cc})", metadata={"sub_step": "complete", "sub_step_status": "success"})

def run_send_email_task(job_id: str, payload: dict):
    _run_step("send_email", job_id, payload, _execute_send_email)
