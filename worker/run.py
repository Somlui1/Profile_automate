import os
import sys
import time
import json
import logging
import datetime
from redis import Redis
import redis
from rq import Worker, Queue

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("worker")

# Add worker directory to path so we can import from core/services locally
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from core.config import settings

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
conn = None
use_mock = False

try:
    conn = Redis.from_url(redis_url)
    conn.ping()
    logger.info(f"Connected to Redis at {redis_url}")
    queues = [Queue("sync", connection=conn)]
except redis.ConnectionError:
    logger.warning(f"Could not connect to Redis at {redis_url}.")
    if settings.DEBUG_MODE:
        logger.warning("DEBUG_MODE=True. Switching worker to mock mode (SQLite/JSON polling).")
        from core.redis_mock import MockRedis, MockQueue
        conn = MockRedis()
        queues = [MockQueue("sync", connection=conn)]
        use_mock = True
    else:
        logger.error("DEBUG_MODE=False. Worker cannot run without Redis.")
        sys.exit(1)

def run_mock_worker_loop():
    logger.info("Starting Mock Worker Loop (polling SQLite for queued jobs)...")
    from core.database import list_jobs, update_job, add_log
    from tasks.sync_user import run_sync_pipeline
    
    # Register worker in mock state
    conn.sadd("rq:workers", "mock-worker-01")
    conn.hset("rq:worker:mock-worker-01", mapping={
        "name": "mock-worker-01",
        "state": "idle",
        "birth_date": datetime.datetime.utcnow().isoformat()
    })
    
    while True:
        try:
            # Poll SQLite database for jobs with status 'queued'
            all_jobs = list_jobs(limit=50)
            queued_jobs = [j for j in all_jobs if j.get("status") == "queued"]
            
            for job in queued_jobs:
                job_id = job["id"]
                payload = job["payload"]
                
                # Check if payload is string or dict
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except Exception:
                        pass
                
                logger.info(f"Mock Worker: Found queued job {job_id}. Processing...")
                conn.hset("rq:worker:mock-worker-01", "state", "busy")
                conn.hset("rq:worker:mock-worker-01", "current_job", job_id)
                
                # Update status of job in Mock Redis too
                job_key = f"rq:job:{job_id}"
                if conn.exists(job_key):
                    try:
                        j_raw = conn.get(job_key)
                        if j_raw:
                            j_data = json.loads(j_raw.decode("utf-8"))
                            j_data["status"] = "started"
                            j_data["started_at"] = datetime.datetime.utcnow().isoformat()
                            conn.set(job_key, json.dumps(j_data))
                    except Exception as ex:
                        logger.error(f"Error updating mock job status: {ex}")
                
                # Run actual pipeline
                try:
                    run_sync_pipeline(job_id, payload)
                    status_outcome = "finished"
                except Exception as err:
                    logger.error(f"Pipeline execution failed: {err}")
                    status_outcome = "failed"
                
                # Update Mock Redis job status on finish
                if conn.exists(job_key):
                    try:
                        j_raw = conn.get(job_key)
                        if j_raw:
                            j_data = json.loads(j_raw.decode("utf-8"))
                            j_data["status"] = status_outcome
                            j_data["ended_at"] = datetime.datetime.utcnow().isoformat()
                            if status_outcome == "failed":
                                j_data["exc_info"] = "Exception: Pipeline failed"
                            conn.set(job_key, json.dumps(j_data))
                    except Exception as ex:
                        logger.error(f"Error updating mock job status on finish: {ex}")
                
                conn.hset("rq:worker:mock-worker-01", "state", "idle")
                conn.hset("rq:worker:mock-worker-01", "current_job", "")
                
                # Also remove from queue list key in Mock Redis
                queue_key = "rq:queue:sync"
                if conn.exists(queue_key):
                    try:
                        q_raw = conn.get(queue_key)
                        if q_raw:
                            q_list = json.loads(q_raw.decode("utf-8"))
                            if job_id in q_list:
                                q_list.remove(job_id)
                                conn.set(queue_key, json.dumps(q_list))
                    except Exception as ex:
                        logger.error(f"Error removing job from mock queue key: {ex}")
                
        except Exception as e:
            logger.error(f"Error in mock worker loop: {e}")
            
        time.sleep(2)

if __name__ == "__main__":
    if use_mock:
        run_mock_worker_loop()
    else:
        worker = Worker(queues, connection=conn)
        worker.work(with_scheduler=False)
