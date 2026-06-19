## Goal
Ensure end-to-end reliability of the provisioning pipeline's logging and UI status reflection. Specifically, guarantee that if a job fails or throws an exception in the backend (`sync_user.py`), the Frontend (`JobQueueTab.tsx`) perfectly reflects this state (e.g., stopping the "running" pulse and marking the specific sub-step as "failed") without visual discrepancies, using `steps_schema.json` as the structural bridge.

## Constraints
- Must rely on `worker/steps_schema.json` as the standard schema mapping for steps and sub-steps.
- UI state rendering strictly depends on parsing the `sub_step_status` from the latest transactional log of each `sub_step`.
- Exception blocks in `sync_user.py` currently emit a generic step-level "failed" log, but do not specify which `sub_step` failed in the metadata. This leaves the latest sub-step log as "running", causing infinite pulsing in the UI.

## Known context
- The UI derives sub-step statuses dynamically: `subStates[log.metadata.sub_step] = (log.metadata.sub_step_status || 'RUNNING').toUpperCase();`
- When an exception occurs in `sync_user.py`, `update_job(job_id, status="failed")` is called and a failed log is added, but it lacks the `metadata` tag pointing to the exact `sub_step` that crashed.
- Because of this missing metadata, the Frontend UI does not override the sub-step state, resulting in a visual bug where the overall job is marked Failed (red), but the sub-step continues to Pulse (blue).

## Risks
- Modifying the backend exception handler to guess the failed `sub_step` might result in inaccurate logs if the context isn't passed down carefully.
- Overriding state purely in the Frontend might mask underlying logging issues, making debugging harder for developers reading the raw database logs.
- Discrepancies between the backend's hardcoded step strings and `steps_schema.json` can cause steps to vanish or misalign in the UI.

## Options (2–4)
1. **Frontend Override (UI Resilience):** Modify `JobQueueTab.tsx` so that if the overall job `status === 'failed'`, any sub-step currently evaluated as `RUNNING` in `subStates` is automatically forced to display as `FAILED`. This guarantees no infinite pulsing regardless of backend log quality.
2. **Backend Context Tracking (Log Accuracy):** Modify `sync_user.py` to track the `current_sub_step` in a variable. When an exception is caught in `_run_step`, use this variable to inject `metadata={"sub_step": current_sub_step, "sub_step_status": "failed"}` into the final error log.
3. **Hybrid Approach (Recommended):** Implement both. Use backend context tracking for clean, accurate database logs, and implement a frontend fallback override to guarantee UI consistency even if a hard crash prevents the backend from logging properly.

## Recommendation
Implement the **Hybrid Approach**. 
- In `JobQueueTab.tsx`, update the mapping logic: if `job.status === 'failed'` and a sub-step is `RUNNING`, set its visual state to `FAILED`. 
- In `sync_user.py`, ensure that when an exception is caught, we attempt to resolve the last active sub-step and log it as `failed` so the database remains fully accurate.

## Acceptance criteria
- When a job throws an exception in `sync_user.py`, the specific sub-step that was executing immediately shows a red dot (`bg-error`) and "failed" text in the Frontend UI.
- No sub-steps are left infinitely pulsing (`animate-pulse`) when a job reaches a terminal `failed` or `cancelled` state.
- `worker/steps_schema.json` continues to drive the dynamic UI rendering successfully without hardcoded UI steps.
