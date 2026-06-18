# Worker Architecture (RQ/Redis)

## Role
The Worker runs entirely detached from the API, processing background jobs asynchronously using `rq` (Redis Queue). It handles Active Directory, M365 Licensing, and Papercut interactions.

## Key Concepts

### 1. `steps_schema.json` as the Single Source of Truth
- The pipeline execution structure is defined in `steps_schema.json`.
- Do not create random new `add_log()` strings for step statuses. The frontend relies on mapping `step` and `sub_step` directly to the keys defined in this JSON file.

### 2. Emitting Logs (`add_log`)
- Whenever a task does work, it calls `add_log()` from `worker/core/database.py`.
- **Crucial Rule**: To support the dynamic UI, you must include a `metadata` dictionary containing `sub_step` and `sub_step_status`. 
- Example: 
  ```python
  add_log(job_id, step="m365_license", message="Assigning...", status="running", 
          metadata={"sub_step": "assign", "sub_step_status": "running"})
  ```

### 3. Pipeline Design
- The main pipeline logic resides in `tasks/sync_user.py`.
- If a step fails, you must set `job.status = 'failed'` and break the execution loop.
- Long-running polling loops (like waiting for Azure AD Connect sync) should use RQ's `enqueue_in` or retry mechanics rather than doing long `time.sleep()`.
