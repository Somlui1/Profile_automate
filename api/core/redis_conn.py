import redis
from rq import Queue
from core.config import settings
import logging

logger = logging.getLogger("app.core.redis")

# Select connection URL based on SYSTEM_MODE setting
redis_url = settings.FAKE_REDIS if settings.SYSTEM_MODE in ["debug", "mock"] else settings.REDIS_URL
logger.info(f"Connecting to Redis at {redis_url} (system_mode={settings.SYSTEM_MODE})")

redis_conn = None
sync_queue = None

try:
    redis_conn = redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
    redis_conn.ping()
    sync_queue = Queue('sync', connection=redis_conn)
    logger.info(f"Successfully connected to Redis at {redis_url}")
except Exception as e:
    logger.error(f"Redis connection failed: {e}")
