# API Architecture (FastAPI)

## Role
This layer acts as the bridge between the React frontend and the backend worker/database. It processes incoming REST requests, enqueues them to the Redis queue, and pushes job statuses back to the frontend in real-time.

## Key Concepts

### 1. SQLite Database Access (`api/core/database.py`)
- The API has read/write access to the central SQLite database (e.g. `sqlite.db`).
- Logs must be serialized and deserialized properly, especially the `metadata` column which contains JSON (used for `steps_schema` mapping).

### 2. Server-Sent Events (SSE) (`/stream` in `jobs.py`)
- The API does **not** do heavy lifting. It offloads tasks to RQ (Redis Queue).
- To keep the frontend updated without polling, it uses SSE (`StreamingResponse` in FastAPI) on the `/api/v1/jobs/stream` endpoint.
- The stream relies on Redis Pub/Sub (`redis_client.pubsub()`) and the SQLite `job_logs` to push standard structures to the frontend.

### 3. Dynamic Configuration (`/api/v1/jobs/steps`)
- To support the Zero-Change Frontend architecture, this API exposes `worker/steps_schema.json` to clients.
- If you add API features related to UI configurations, they must remain driven by the schema file rather than hardcoded logic.
