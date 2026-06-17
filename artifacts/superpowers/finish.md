## Execution Summary
The plan to improve visibility of delayed tasks in the `sync_user` pipeline was successfully executed.

### Changes Made
- Modified the task routing logic in `worker/tasks/sync_user.py` (`move_to_next_step` and `run_sync_pipeline`).
- Added an explicit `if/else` check on the `delay` attribute of the `next_step` / `step`.
- For delayed tasks, the system now logs: `[DELAYED TASK] Enqueuing <step_id> task with a delay of <delay> (Waiting for execution...)` via `logger.info` and updates the DB status to `pending`.
- For immediate tasks, the system logs: `Enqueuing <step_id> task for immediate execution` and updates the DB status to `running`.

### Verification
- **Command Run**: `python temp/mock_test_sync_user.py virtual`
- **Result**: The console output clearly shows the `[DELAYED TASK]` message with the `0:05:00` delay duration when the `m365_license` task is queued, followed by the mock execution completing. 

### Follow-ups
- Developers monitoring the worker logs in production should now clearly see when the pipeline is waiting for an Azure AD sync delay versus when it has finished completely.
