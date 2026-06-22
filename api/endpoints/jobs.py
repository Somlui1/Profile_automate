from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from sse_starlette.sse import EventSourceResponse
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import asyncio
import json
import logging

from core.database import create_job, get_job, get_logs, update_job, list_jobs, add_log, delete_job
from core.redis_conn import sync_queue
from endpoints.user import UserSyncRequest

router = APIRouter()
logger = logging.getLogger("app.api.jobs")

class JobActionRequest(BaseModel):
    action: str # pause, resume, cancel

@router.post("/sync")
def create_sync_job(payload: UserSyncRequest):
    if not sync_queue:
        raise HTTPException(status_code=503, detail="Redis queue is not available")
    
    # Store job in SQLite
    payload_dict = payload.dict()
    job_id = create_job(payload_dict)
    
    # Enqueue job in RQ
    sync_queue.enqueue(
        'tasks.sync_user.run_sync_pipeline',
        job_id,
        payload_dict,
        job_id=job_id,
        job_timeout=600
    )
    
    add_log(job_id, "queue", "success", "Job enqueued successfully")
    return {"job_id": job_id, "status": "queued"}

@router.get("/steps")
def get_steps_schema():
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # In Docker: /app/endpoints/jobs.py -> /app/worker/steps_schema.json
    docker_path = os.path.join(os.path.dirname(current_dir), "worker", "steps_schema.json")
    # Local dev: /api/endpoints/jobs.py -> /worker/steps_schema.json
    local_path = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "worker", "steps_schema.json")
    
    schema_path = docker_path if os.path.exists(docker_path) else local_path
    
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="steps_schema.json not found")

@router.get("/")
def get_jobs(limit: int = 50, offset: int = 0):
    jobs = list_jobs(limit, offset)
    return {"jobs": jobs}

@router.get("/stream")
async def jobs_stream_all(request: Request):
    """SSE Endpoint for all jobs list real-time updates"""
    async def event_generator():
        last_updated_map = {}
        while True:
            if await request.is_disconnected():
                break
            try:
                jobs = list_jobs(limit=50)
                current_map = {j["id"]: j["updated_at"] for j in jobs}
                if current_map != last_updated_map:
                    yield {
                        "event": "jobs_list",
                        "data": json.dumps({"jobs": jobs})
                    }
                    last_updated_map = current_map
            except Exception as e:
                logger.error(f"Error in jobs stream: {e}")
            await asyncio.sleep(1)
    return EventSourceResponse(event_generator())

@router.get("/{job_id}")
def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/{job_id}/logs")
def get_job_logs(job_id: str):
    logs = get_logs(job_id)
    return {"logs": logs}

@router.patch("/{job_id}")
def update_job_action(job_id: str, payload: JobActionRequest):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    action = payload.action.lower()
    step_name = job.get("current_step") or "pipeline"
    
    if action == "pause":
        if job["status"] not in ["queued", "processing"]:
            raise HTTPException(status_code=400, detail=f"Cannot pause job in {job['status']} state")
        update_job(job_id, status="paused")
        add_log(job_id, step_name, "paused", "งานถูกหยุดชั่วคราวโดยผู้ดูแลระบบ (Job paused by admin)")
        return {"status": "paused"}
        
    elif action == "resume":
        if job["status"] != "paused":
            raise HTTPException(status_code=400, detail=f"Cannot resume job in {job['status']} state")
        update_job(job_id, status="processing")
        add_log(job_id, step_name, "running", "งานถูกดำเนินการต่อโดยผู้ดูแลระบบ (Job resumed by admin)")
        return {"status": "processing"}
        
    elif action == "cancel":
        if job["status"] in ["success", "failed", "cancelled"]:
            raise HTTPException(status_code=400, detail=f"Cannot cancel job in {job['status']} state")
        update_job(job_id, status="cancelled")
        add_log(job_id, step_name, "failed", "งานถูกยกเลิกโดยผู้ดูแลระบบ (Job cancelled by admin)")
        return {"status": "cancelled"}
        
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@router.delete("/{job_id}")
def delete_job_route(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] not in ["success", "failed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot delete an active or queued job")
        
    delete_job(job_id)
    return {"status": "deleted"}

@router.get("/{job_id}/stream")
async def job_stream(request: Request, job_id: str):
    """SSE Endpoint for realtime job updates"""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_updated = ""
        last_log_id = 0
        
        while True:
            # If client closes connection, stop
            if await request.is_disconnected():
                break

            current_job = get_job(job_id)
            if not current_job:
                break
                
            # Check for new logs
            logs = get_logs(job_id)
            new_logs = [log for log in logs if log["id"] > last_log_id]
            
            if new_logs:
                for log in new_logs:
                    yield {
                        "event": "step_update",
                        "data": json.dumps({
                            "step": log["step"],
                            "status": log["status"],
                            "message": log["message"],
                            "metadata": log.get("metadata")
                        })
                    }
                    last_log_id = log["id"]
            
            # Check for status changes
            if current_job["updated_at"] != last_updated:
                if current_job["status"] in ["success", "failed", "cancelled"]:
                    yield {
                        "event": "job_complete" if current_job["status"] == "success" else f"job_{current_job['status']}",
                        "data": json.dumps(current_job)
                    }
                    break
                elif current_job["status"] == "paused":
                    yield {
                        "event": "job_paused",
                        "data": json.dumps({"message": "Job paused by admin"})
                    }
                last_updated = current_job["updated_at"]
                
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
