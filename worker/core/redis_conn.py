import redis
from rq import Queue
from core.config import settings
import logging

logger = logging.getLogger("app.core.redis")

# Connect to Redis
try:
    redis_conn = redis.Redis.from_url(settings.REDIS_URL)
    # Ping to test connection
    redis_conn.ping()
    logger.info(f"Connected to Redis at {settings.REDIS_URL}")
    sync_queue = Queue('sync', connection=redis_conn)
except redis.ConnectionError:
    logger.warning(f"Could not connect to Redis at {settings.REDIS_URL} during startup.")
    if settings.DEBUG_MODE:
        logger.warning("DEBUG_MODE=True. Falling back to MockRedis and MockQueue.")
        from core.redis_mock import MockRedis, MockQueue
        redis_conn = MockRedis()
        sync_queue = MockQueue('sync', connection=redis_conn)
    else:
        logger.error("DEBUG_MODE=False. Queue will not work.")
        redis_conn = None
        sync_queue = None
