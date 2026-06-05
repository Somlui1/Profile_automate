import time
import logging
from core.database import get_job, update_job, add_log
from core.config import settings

logger = logging.getLogger("worker.pipeline")

class JobCancelled(Exception):
    pass

def _check_should_stop(job_id: str, step_name: str, context: dict):
    job = get_job(job_id)
    if not job:
        return
        
    if job["status"] == "cancelled":
        if context.get("ad_created") and settings.JOB_CANCEL_ROLLBACK_AD:
            try:
                from services.ad_service import ad_service
                logger.info(f"Rolling back AD account: {context['username']}")
                ad_service.delete_user(context['username'])
                add_log(job_id, step_name, "cancelled", "Job cancelled by admin (AD Rolled back)")
            except Exception as e:
                add_log(job_id, step_name, "failed", f"Failed to rollback AD: {e}")
        else:
            add_log(job_id, step_name, "cancelled", "Job cancelled by admin")
        raise JobCancelled()

    if job["status"] == "paused":
        add_log(job_id, step_name, "paused", f"Paused at {step_name}")
        while True:
            time.sleep(2)
            job = get_job(job_id)
            if job["status"] == "processing":
                add_log(job_id, step_name, "resumed", "Resumed by admin")
                break
            if job["status"] == "cancelled":
                raise JobCancelled()

def run_pipeline(job_id: str, payload: dict, steps: list, init_context_func=None):
    update_job(job_id, status="processing")
    context = {}
    if init_context_func:
        context = init_context_func(payload)
        
    try:
        for step in steps:
            step_id = step["id"]
            update_job(job_id, current_step=step_id)
            
            _check_should_stop(job_id, step_id, context)
            
            add_log(job_id, step_id, "running", f"Starting: {step['name']}")
            try:
                result = step["func"](job_id, payload, context)
                add_log(job_id, step_id, result.get("status", "success"), result.get("message", ""))
                
                # Check again in case it was cancelled during the step execution
                _check_should_stop(job_id, step_id, context)
                
            except Exception as e:
                add_log(job_id, step_id, "failed", f"Error: {str(e)}")
                raise e
                
        update_job(job_id, status="success", result=context.get("final_result", {}))
        
    except JobCancelled:
        pass # Already handled in _check_should_stop
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        update_job(job_id, status="failed", error=str(e))
