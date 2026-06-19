## Goal
Implement the Hybrid Approach to ensure accurate UI status reflection when exceptions occur during job execution. The UI and backend logs must correctly mark any active "running" sub-step as "failed" when a job crashes or is cancelled.

## Assumptions
- The database schema for `add_log` allows passing `metadata` arguments.
- In `sync_user.py`, `get_job_logs(job_id)` or a similar function can be used to retrieve the current logs for the job to determine the last active sub-step.
- The UI mapping logic in `JobQueueTab.tsx` evaluates sub-step states sequentially based on the cache.

## Plan
### Step 1: Update Frontend Override Logic
- **Files**: `frontend/src/components/JobQueueTab.tsx`
- **Change**: After `stepLogs.forEach` calculates the `subStates`, add a check: if the overall job `status === 'failed'` or `'cancelled'`, iterate over `subStates` and change any state that is `'RUNNING'` to `'FAILED'`. 
- **Verify**: Inspect `JobQueueTab.tsx` to ensure the override logic exists before rendering the `sub_steps.map`.

### Step 2: Implement Backend Log Accuracy
- **Files**: `worker/tasks/sync_user.py`
- **Change**: In the `_run_step` exception handler, query the database or just use the last log state if tracked, to find the last `sub_step` that was marked `running`. Then inject `metadata={"sub_step": last_sub_step, "sub_step_status": "failed"}` into the `add_log` call for the failure message. 
- **Verify**: Check that `add_log` in the `except` block now receives the correct metadata dictionary identifying the failed sub-step.

## Risks & mitigations
- **Risk**: Backend exception handler fails to query logs or determine the active sub-step, crashing the error handler itself.
- **Mitigation**: Wrap the sub-step discovery logic in a `try...except` block so that if it fails, it defaults to the original generic failure log without metadata.

## Rollback plan
- Revert the changes in `JobQueueTab.tsx` and `sync_user.py` to their previous states using Git or undoing the exact chunk modifications.
