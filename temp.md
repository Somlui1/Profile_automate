## Goal
Improve visibility of delayed tasks (like `m365_license`) by adding clear console logging and updating database log statuses to "pending" when a task is scheduled for future execution. This will help developers easily debug the pipeline flow.

## Assumptions
- `logger` and `add_log` are the standard ways to record task lifecycle events in `worker/tasks/sync_user.py`.
- We only need to modify `run_sync_pipeline` and `move_to_next_step`, where task routing and enqueuing occurs.
- The `logger.info` output will be visible in the console running the worker.

## Plan

### Step 1: Update task routing logic to log delays clearly
- **Files**: `worker/tasks/sync_user.py`
- **Change**: In both `run_sync_pipeline` and `move_to_next_step`, replace the simple `add_log` call before enqueuing with an `if-else` check on the `delay` attribute:
  - If a step has a delay:
    - Call `logger.info` with a clear message: `[DELAYED TASK] Enqueuing <step_id> task to run in <delay>...`
    - Call `add_log` with status `"pending"`.
  - If a step does not have a delay:
    - Call `logger.info` noting immediate execution.
    - Call `add_log` with status `"running"`.
- **Verify**: Run `python temp/mock_test_sync_user.py virtual` (which mocks the queue and triggers the pipeline) or check the API test logs to ensure the terminal prints `[DELAYED TASK]` with the time duration when queuing the `m365_license` task.

## Risks & mitigations
- **Risk**: Duplicated logic between `move_to_next_step` and `run_sync_pipeline`.
- **Mitigation**: The logic is short (a single `if-else` block). If we want to avoid duplication, we could create a helper function, but keeping the blocks inline is simpler and less risky for a quick fix.

## Rollback plan
- Revert the `if-else` blocks in `run_sync_pipeline` and `move_to_next_step` back to the single `add_log` statement.
