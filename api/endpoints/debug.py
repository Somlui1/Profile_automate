from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import json
import uuid
import datetime

from pydantic import BaseModel
import logging
from core.config import settings
from core.redis_conn import redis_conn, sync_queue
# pyrefly: ignore [missing-import]
from rq.job import Job
# pyrefly: ignore [missing-import]
from rq.registry import StartedJobRegistry, FailedJobRegistry, DeferredJobRegistry
# pyrefly: ignore [missing-import]
from rq import Worker

router = APIRouter()
logger = logging.getLogger("app.endpoints.debug")

class ModeRequest(BaseModel):
    mode: str

@router.get("/mode")
def get_system_mode():
    return {"mode": settings.SYSTEM_MODE}

@router.post("/mode")
def set_system_mode(payload: ModeRequest):
    if payload.mode not in ["mock", "live", "debug"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'mock', 'live', or 'debug'")
    
    settings.SYSTEM_MODE = payload.mode
    logger.info(f"System mode changed dynamically to: {payload.mode} (SYSTEM_MODE={settings.SYSTEM_MODE})")
    return {"status": "success", "mode": settings.SYSTEM_MODE}

def check_debug_mode():
    if not settings.DEBUG_MODE:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")

@router.get("/queue/status", dependencies=[Depends(check_debug_mode)])
def get_queue_status():
    if not sync_queue:
        return {"status": "error", "message": "Redis queue not available"}
        
    started_registry = StartedJobRegistry('sync', connection=redis_conn)
    failed_registry = FailedJobRegistry('sync', connection=redis_conn)
    deferred_registry = DeferredJobRegistry('sync', connection=redis_conn)
    
    workers = Worker.all(connection=redis_conn)
    worker_data = []
    for w in workers:
        worker_data.append({
            "name": w.name,
            "state": w.state,
            "current_job": w.get_current_job_id(),
            "birth_date": w.birth_date.isoformat() if w.birth_date else None
        })
        
    return {
        "queue_name": "sync",
        "queued": len(sync_queue),
        "started": len(started_registry),
        "failed": len(failed_registry),
        "deferred": len(deferred_registry),
        "workers": worker_data
    }

@router.get("/queue/jobs", dependencies=[Depends(check_debug_mode)])
def get_queue_jobs():
    if not sync_queue:
        return {"status": "error"}
        
    jobs = sync_queue.jobs
    job_data = []
    for job in jobs:
        job_data.append({
            "id": job.id,
            "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
            "status": job.get_status(),
            "meta": job.meta
        })
    return {"jobs": job_data}

@router.get("/queue/jobs/{job_id}", dependencies=[Depends(check_debug_mode)])
def get_job_details(job_id: str):
    if not redis_conn:
        return {"status": "error"}
        
    try:
        job = Job.fetch(job_id, connection=redis_conn)
            
        return {
            "job_id": job.id,
            "status": job.get_status(),
            "origin": getattr(job, "origin", "sync"),
            "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "ended_at": job.ended_at.isoformat() if job.ended_at else None,
            "func_name": job.func_name,
            "args": str(job.args),
            "kwargs": str(job.kwargs),
            "meta": job.meta,
            "timeout": job.timeout,
            "result": str(job.result) if job.result else None,
            "exc_info": job.exc_info
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Job not found or error: {str(e)}")

@router.get("/db/jobs", dependencies=[Depends(check_debug_mode)])
def get_db_jobs(limit: int = 50, offset: int = 0):
    from core.database import list_jobs
    try:
        jobs = list_jobs(limit, offset)
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/db/jobs/{job_id}", dependencies=[Depends(check_debug_mode)])
def get_db_job_detail(job_id: str):
    from core.database import get_job, get_logs
    try:
        job = get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found in database")
        logs = get_logs(job_id)
        return {
            "job": job,
            "logs": logs
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/db/status", dependencies=[Depends(check_debug_mode)])
def get_db_status():
    from core.database import get_db_connection
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Count by status
        cursor.execute("SELECT status, COUNT(*) as count FROM jobs GROUP BY status")
        rows = cursor.fetchall()
        status_counts = {row["status"]: row["count"] for row in rows}
        
        # Total count
        cursor.execute("SELECT COUNT(*) as count FROM jobs")
        total_count = cursor.fetchone()["count"]
        
        # Count by current_step
        cursor.execute("SELECT current_step, COUNT(*) as count FROM jobs GROUP BY current_step")
        step_rows = cursor.fetchall()
        step_counts = {row["current_step"] or "unknown": row["count"] for row in step_rows}
        
        conn.close()
        
        return {
            "total_jobs": total_count,
            "status_breakdown": status_counts,
            "step_breakdown": step_counts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/redis/keys", dependencies=[Depends(check_debug_mode)])
def get_redis_keys():
    if not redis_conn:
        return {"status": "error"}
        
    keys = redis_conn.keys("rq:*")
    key_data = []
    for k in keys:
        k_str = k.decode('utf-8')
        k_type = redis_conn.type(k).decode('utf-8')
        ttl = redis_conn.ttl(k)
        
        info = {"key": k_str, "type": k_type, "ttl": ttl}
        if k_type == "list":
            info["length"] = redis_conn.llen(k)
        elif k_type == "set":
            info["members"] = redis_conn.scard(k)
            
        key_data.append(info)
        
    return {
        "total_keys": len(keys),
        "keys": key_data
    }

@router.delete("/queue/flush", dependencies=[Depends(check_debug_mode)])
def flush_queue():
    if not sync_queue:
        return {"status": "error"}
        
    count = sync_queue.empty()
    return {"status": "success", "cleared_jobs": count}

@router.post("/queue/test-enqueue", dependencies=[Depends(check_debug_mode)])
def test_enqueue():
    if not sync_queue:
        return {"status": "error"}
        
    job_id = str(uuid.uuid4())
    mock_payload = {
        "document_info": {"date": "05/06/26", "doc_no": "TEST-001"},
        "requester_info": {
            "name_english": "Test User",
            "employee_id": "T0001",
            "company": "AAPICO",
            "department": "IT"
        },
        "custom_username": f"test.user_{job_id[:4]}",
        "is_contractor": False
    }
    
    from core.database import create_job
    db_job_id = create_job(mock_payload)
    
    sync_queue.enqueue(
        'tasks.sync_user.run_sync_pipeline',
        db_job_id,
        mock_payload,
        job_id=db_job_id,
        job_timeout=600
    )
    
    return {"status": "success", "job_id": db_job_id, "message": "Test job enqueued"}

@router.delete("/queue/jobs/{job_id}", dependencies=[Depends(check_debug_mode)])
def clear_job_by_uuid(job_id: str):
    if not redis_conn:
        raise HTTPException(status_code=503, detail="Redis connection not available")
    
    cancelled_in_redis = False
    try:
        job = Job.fetch(job_id, connection=redis_conn)
        if job:
            job.cancel()
            job.delete()
            cancelled_in_redis = True
    except Exception as e:
        logger.warning(f"Could not cancel job {job_id} in Redis: {e}")
        
    from core.database import get_job, update_job, add_log
    db_job = get_job(job_id)
    if not db_job:
        if not cancelled_in_redis:
            raise HTTPException(status_code=404, detail="Job not found in Redis or Database")
        return {"status": "success", "message": f"Job {job_id} removed from Redis queue (not found in DB)"}
        
    if db_job["status"] not in ["success", "failed", "cancelled"]:
        update_job(job_id, status="cancelled", error="Cancelled by administrator from queue")
        add_log(job_id, "queue", "failed", "Job cancelled and removed from queue by administrator")
        return {"status": "success", "message": f"Job {job_id} cancelled and removed from queue successfully"}
    else:
        return {"status": "ignored", "message": f"Job {job_id} already in final state: {db_job['status']}"}

@router.delete("/queue/jobs", dependencies=[Depends(check_debug_mode)])
def clear_all_queued_jobs():
    if not sync_queue:
        raise HTTPException(status_code=503, detail="Redis queue not available")
        
    cleared_count = 0
    try:
        job_ids = sync_queue.job_ids
        for job_id in job_ids:
            try:
                job = Job.fetch(job_id, connection=redis_conn)
                if job:
                    job.cancel()
                    job.delete()
                    cleared_count += 1
            except Exception:
                pass
        sync_queue.empty()
    except Exception as e:
        logger.error(f"Error clearing RQ queue: {e}")
        
    from core.database import get_db_connection, update_job, add_log
    updated_count = 0
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM jobs WHERE status = 'queued'")
        rows = cursor.fetchall()
        queued_ids = [row["id"] for row in rows]
        conn.close()
        
        for j_id in queued_ids:
            update_job(j_id, status="cancelled", error="Queue flushed by administrator")
            add_log(j_id, "queue", "failed", "Job cancelled due to administrative queue flush")
            updated_count += 1
    except Exception as e:
        logger.error(f"Error updating database jobs status: {e}")
        
    return {
        "status": "success",
        "redis_jobs_cleared": cleared_count,
        "database_jobs_cancelled": updated_count
    }
