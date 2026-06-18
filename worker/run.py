import os
import sys
import time
import json
import logging
import datetime
from redis import Redis
import redis
from rq import Worker, Queue
from core.config import settings

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

# Select connection URL based on SYSTEM_MODE setting
redis_url = settings.FAKE_REDIS if settings.SYSTEM_MODE in ["debug", "mock"] else settings.REDIS_URL

border = "=" * 62
print(f"\n{border}")
print(f"  🚀  RQ Worker | SYSTEM_MODE: {settings.SYSTEM_MODE.upper()}")
print(border)
print(f"  🛢️  Redis Server: {redis_url}")
print(f"{border}\n")

logger.info(f"Worker connecting to Redis at {redis_url} (system_mode={settings.SYSTEM_MODE})")

try:
    conn = Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
    conn.ping()
    logger.info(f"Connected to Redis at {redis_url}")
    queues = [Queue("sync", connection=conn)]
except redis.ConnectionError as e:
    logger.error(f"Worker connection failed: {e}")
    sys.exit(1)

# --- Startup Health Checks ---
from services.health_check import health_checker
print("\n--- Running Startup Health Checks ---")

checks = [
    ("Active Directory", health_checker.check_ad),
    ("PaperCut", health_checker.check_papercut),
    ("Redis", health_checker.check_redis),
    ("Graph API (M365)", health_checker.check_m365),
    ("Database", health_checker.check_database),
    ("Backend API", health_checker.check_backend_api)
]

for name, check_fn in checks:
    ok, msg = check_fn()
    icon = "[PASS]" if ok else "[FAIL]"
    print(f"{icon} {name}: {msg}")
    if not ok:
        logger.warning(f"Startup check failed for {name}: {msg}")

print("-------------------------------------\n")

if __name__ == "__main__":
    if os.name == 'nt':
        from rq import SimpleWorker
        logger.info("Running on Windows: using SimpleWorker")
        worker = SimpleWorker(queues, connection=conn)
    else:
        worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=True)
