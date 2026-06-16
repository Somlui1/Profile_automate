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

# Select connection URL based on MOCK_REDIS setting
redis_url = settings.FAKE_REDIS if settings.MOCK_REDIS else settings.REDIS_URL
logger.info(f"Worker connecting to Redis at {redis_url} (mock_mode={settings.MOCK_REDIS})")

try:
    conn = Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
    conn.ping()
    logger.info(f"Connected to Redis at {redis_url}")
    queues = [Queue("sync", connection=conn)]
except redis.ConnectionError as e:
    logger.error(f"Worker connection failed: {e}")
    sys.exit(1)

if __name__ == "__main__":
    worker = Worker(queues, connection=conn)
    worker.work(with_scheduler=False)
