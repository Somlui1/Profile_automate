from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import json
import uuid
import datetime

from core.config import settings
from core.redis_conn import redis_conn, sync_queue
from rq.job import Job
from rq.registry import StartedJobRegistry, FailedJobRegistry, DeferredJobRegistry
from rq import Worker

router = APIRouter()

def check_debug_mode():
    if not settings.DEBUG_MODE:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")

@router.get("/queue/status", dependencies=[Depends(check_debug_mode)])
def get_queue_status():
    if not sync_queue:
        return {"status": "error", "message": "Redis queue not available"}
        
    if hasattr(redis_conn, "db_path"):
        worker_data = []
        if redis_conn.exists("rq:workers"):
            worker_names = redis_conn.smembers("rq:workers")
            for w_name in worker_names:
                w_name = w_name.decode("utf-8") if isinstance(w_name, bytes) else w_name
                w_info = redis_conn.hgetall(f"rq:worker:{w_name}")
                info = {}
                for k, v in w_info.items():
                    k_str = k.decode("utf-8") if isinstance(k, bytes) else k
                    v_str = v.decode("utf-8") if isinstance(v, bytes) else v
                    info[k_str] = v_str
                worker_data.append({
                    "name": info.get("name", w_name),
                    "state": info.get("state", "idle"),
                    "current_job": info.get("current_job"),
                    "birth_date": info.get("birth_date")
                })
        else:
            worker_data = [{
                "name": "mock-worker-01",
                "state": "idle",
                "current_job": None,
                "birth_date": "2026-06-05T10:00:00Z"
            }]
        return {
            "queue_name": "sync",
            "queued": len(sync_queue),
            "started": 0,
            "failed": 0,
            "deferred": 0,
            "workers": worker_data
        }
        
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
        if hasattr(redis_conn, "db_path"):
            from core.redis_mock import MockJob
            job = MockJob.fetch(job_id, connection=redis_conn)
        else:
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
