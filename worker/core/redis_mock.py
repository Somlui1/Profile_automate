import os
import re
import json
import logging
import datetime
from typing import Optional, Dict, Any, List

logger = logging.getLogger("app.core.redis_mock")

class MockRedis:
    def __init__(self, db_path: str = None, state_path: str = None):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.db_path = db_path or os.path.join(project_root, "worker", "mock.txt")
        self.state_path = state_path or os.path.join(project_root, "data", "redis_state.json")
        self.data = {}
        self.load_data()

    def load_data(self):
        # 1. Load from template mock.txt if state doesn't exist
        if not os.path.exists(self.state_path) and os.path.exists(self.db_path):
            logger.info(f"Mock state not found. Initializing from template: {self.db_path}")
            self.parse_mock_txt()
            self.save_state()
        elif os.path.exists(self.state_path):
            try:
                with open(self.state_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception as e:
                logger.error(f"Error loading mock state: {e}. Falling back to parsing mock.txt")
                self.parse_mock_txt()
        else:
            logger.warning("Neither mock state nor template found. Initializing empty database.")
            self.data = {}

    def parse_mock_txt(self):
        self.data = {}
        if not os.path.exists(self.db_path):
            return
        with open(self.db_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                if len(parts) >= 3:
                    key = parts[0].strip()
                    k_type = parts[1].strip().lower()
                    val_str = parts[2].strip()
                    try:
                        val = json.loads(val_str)
                    except Exception:
                        val = val_str
                    self.data[key] = {"type": k_type, "value": val}

    def save_state(self):
        try:
            os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to write mock Redis state: {e}")

    def ping(self):
        return True

    def keys(self, pattern="*"):
        # Convert redis pattern (e.g. rq:*) to regex
        regex_pat = pattern.replace("*", ".*")
        regex = re.compile(f"^{regex_pat}$")
        keys = [k for k in self.data.keys() if regex.match(k)]
        return [k.encode("utf-8") for k in keys]

    def type(self, key):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        if key in self.data:
            return self.data[key]["type"].encode("utf-8")
        return b"none"

    def ttl(self, key):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        return 3600 if key in self.data else -2

    def llen(self, key):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        if key in self.data and self.data[key]["type"] == "list":
            return len(self.data[key]["value"])
        return 0

    def scard(self, key):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        if key in self.data and self.data[key]["type"] == "set":
            return len(self.data[key]["value"])
        return 0

    def get(self, key):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        # Reload state in case other process updated it
        self.load_data()
        if key in self.data:
            val = self.data[key]["value"]
            if isinstance(val, (dict, list)):
                return json.dumps(val).encode("utf-8")
            return str(val).encode("utf-8")
        return None

    def set(self, key, value, ex=None):
        if isinstance(key, bytes):
            key = key.decode("utf-8")
        if isinstance(value, bytes):
            value = value.decode("utf-8")
        
        try:
            val = json.loads(value)
        except Exception:
            val = value
            
        self.data[key] = {"type": "string", "value": val}
        self.save_state()
        return True

    def hset(self, name, key=None, value=None, mapping=None):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        
        self.load_data()
        if name not in self.data:
            self.data[name] = {"type": "hash", "value": {}}
        
        if mapping:
            for k, v in mapping.items():
                if isinstance(k, bytes): k = k.decode("utf-8")
                if isinstance(v, bytes): v = v.decode("utf-8")
                self.data[name]["value"][k] = v
        elif key is not None:
            if isinstance(key, bytes): key = key.decode("utf-8")
            if isinstance(value, bytes): value = value.decode("utf-8")
            self.data[name]["value"][key] = value
            
        self.save_state()
        return 1

    def hgetall(self, name):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        self.load_data()
        if name in self.data and self.data[name]["type"] == "hash":
            res = {}
            for k, v in self.data[name]["value"].items():
                res[k.encode("utf-8")] = str(v).encode("utf-8")
            return res
        return {}

    def lpush(self, name, *values):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        
        self.load_data()
        if name not in self.data:
            self.data[name] = {"type": "list", "value": []}
            
        for val in values:
            if isinstance(val, bytes):
                val = val.decode("utf-8")
            self.data[name]["value"].insert(0, val)
            
        self.save_state()
        return len(self.data[name]["value"])

    def sadd(self, name, *values):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
            
        self.load_data()
        if name not in self.data:
            self.data[name] = {"type": "set", "value": []}
            
        added = 0
        for val in values:
            if isinstance(val, bytes):
                val = val.decode("utf-8")
            if val not in self.data[name]["value"]:
                self.data[name]["value"].append(val)
                added += 1
                
        self.save_state()
        return added

    def smembers(self, name):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        self.load_data()
        if name in self.data and self.data[name]["type"] == "set":
            return {str(v).encode("utf-8") for v in self.data[name]["value"]}
        return set()

    def delete(self, *names):
        self.load_data()
        deleted = 0
        for name in names:
            if isinstance(name, bytes):
                name = name.decode("utf-8")
            if name in self.data:
                del self.data[name]
                deleted += 1
        if deleted > 0:
            self.save_state()
        return deleted

    def exists(self, name):
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        self.load_data()
        return 1 if name in self.data else 0


class MockJob:
    def __init__(self, job_id: str, func_name: str = "", args: tuple = None, kwargs: dict = None, timeout: int = 600, connection = None):
        self.id = job_id
        self.func_name = func_name
        self.args = args or ()
        self.kwargs = kwargs or {}
        self.timeout = timeout
        self.enqueued_at = datetime.datetime.utcnow()
        self.started_at = None
        self.ended_at = None
        self.meta = {}
        self.result = None
        self.exc_info = None
        self.connection = connection
        self._status = "queued"

    def get_status(self):
        return self._status

    @classmethod
    def fetch(cls, job_id: str, connection = None):
        if not connection:
            from core.redis_conn import redis_conn
            connection = redis_conn
            
        if hasattr(connection, "exists") and connection.exists(f"rq:job:{job_id}"):
            raw_data = connection.get(f"rq:job:{job_id}")
            if raw_data:
                try:
                    data = json.loads(raw_data.decode("utf-8"))
                    job = cls(job_id, connection=connection)
                    job._status = data.get("status", "queued")
                    job.func_name = data.get("func_name", "")
                    job.args = tuple(data.get("args", []))
                    job.meta = data.get("meta", {})
                    job.exc_info = data.get("exc_info")
                    
                    # Parse timestamps
                    for ts_field in ["enqueued_at", "started_at", "ended_at"]:
                        ts_val = data.get(ts_field)
                        if ts_val:
                            try:
                                setattr(job, ts_field, datetime.datetime.fromisoformat(ts_val))
                            except Exception:
                                pass
                    return job
                except Exception as e:
                    logger.error(f"Error parsing job data: {e}")
        raise Exception(f"Job {job_id} not found in Mock Redis")


class MockQueue:
    def __init__(self, name: str = "sync", connection = None):
        self.name = name
        self.connection = connection

    def enqueue(self, func_name: str, *args, **kwargs):
        import uuid
        import importlib
        job_id = kwargs.get("job_id") or str(uuid.uuid4())
        job_timeout = kwargs.get("job_timeout", 600)
        
        # Strip internal RQ args if any
        job_args = args
        
        # Create Job object
        job = MockJob(job_id, func_name=func_name, args=job_args, kwargs=kwargs, timeout=job_timeout, connection=self.connection)
        
        # Store in connection
        job_data = {
            "id": job_id,
            "status": "queued",
            "func_name": func_name,
            "args": job_args,
            "meta": {},
            "enqueued_at": job.enqueued_at.isoformat()
        }
        
        queue_key = f"rq:queue:{self.name}"
        job_key = f"rq:job:{job_id}"
        
        self.connection.set(job_key, json.dumps(job_data))
        
        # Append job_id to queue list
        current_queue = []
        if self.connection.exists(queue_key):
            raw_q = self.connection.get(queue_key)
            if raw_q:
                try:
                    current_queue = json.loads(raw_q.decode("utf-8"))
                except Exception:
                    pass
        if job_id not in current_queue:
            current_queue.append(job_id)
        self.connection.set(queue_key, json.dumps(current_queue))
        
        logger.info(f"MockQueue: Enqueued job {job_id}")
        
        # Resolve and execute function dynamically in mock mode
        try:
            parts = func_name.split('.')
            module_name = '.'.join(parts[:-1])
            func_attr = parts[-1]
            mod = importlib.import_module(module_name)
            func = getattr(mod, func_attr)
            
            logger.info(f"MockQueue: Executing {func_name} synchronously...")
            func(*args)
        except Exception as e:
            logger.error(f"MockQueue failed to execute {func_name} synchronously: {e}")
            
        return job

    def enqueue_in(self, time_delta, func_name, *args, **kwargs):
        logger.info(f"MockQueue: enqueue_in scheduled with delay {time_delta}. Enqueuing immediately in mock mode.")
        return self.enqueue(func_name, *args, **kwargs)

    def empty(self):
        queue_key = f"rq:queue:{self.name}"
        job_ids = []
        if self.connection.exists(queue_key):
            raw_q = self.connection.get(queue_key)
            if raw_q:
                try:
                    job_ids = json.loads(raw_q.decode("utf-8"))
                except Exception:
                    pass
        
        for jid in job_ids:
            self.connection.delete(f"rq:job:{jid}")
        
        self.connection.delete(queue_key)
        logger.info(f"MockQueue: Cleared {len(job_ids)} jobs")
        return len(job_ids)

    @property
    def jobs(self):
        queue_key = f"rq:queue:{self.name}"
        job_ids = []
        if self.connection.exists(queue_key):
            raw_q = self.connection.get(queue_key)
            if raw_q:
                try:
                    job_ids = json.loads(raw_q.decode("utf-8"))
                except Exception:
                    pass
        
        job_list = []
        for jid in job_ids:
            try:
                job_list.append(MockJob.fetch(jid, connection=self.connection))
            except Exception:
                pass
        return job_list

    def __len__(self):
        queue_key = f"rq:queue:{self.name}"
        if self.connection.exists(queue_key):
            raw_q = self.connection.get(queue_key)
            if raw_q:
                try:
                    return len(json.loads(raw_q.decode("utf-8")))
                except Exception:
                    pass
        return 0
