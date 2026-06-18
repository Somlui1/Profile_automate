## Goal
Implement a revised M365 licensing workflow in the worker task pipeline that uses the RQ scheduler to perform asynchronous Azure AD sync checks (2-minute delay, up to 3 retries, failing with a clear log if not found) and verifies the `usageLocation` propagation before assigning licenses.

## Assumptions
- The worker runs in Docker with Redis access.
- The `sync_queue.enqueue_in` scheduler is functional and handles delayed tasks.
- No emojis are used in the codebase.

## Plan

### Step 1: Add `get_user_usage_location` to `m365_service.py`
- **Files**: [m365_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/m365_service.py)
- **Change**: 
  - Add the `get_user_usage_location(self, user_principal_name: str) -> Optional[str]` method.
  - It requests `GET /users/{upn}?$select=usageLocation` to fetch the usageLocation property.
  - Returns the location string (e.g. `"TH"`) or `None` if not found or empty. In mock mode, returns `"TH"`.
- **Verify**:
  - Run syntax check:
    ```bash
    python -c "import sys; sys.path.append('worker'); from services.m365_service import m365_service; print('Import OK')"
    ```

### Step 2: Implement Scheduler-based Sync Check and Verification Loop in `sync_user.py`
- **Files**: [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
- **Change**:
  - In `_execute_m365_license`:
    - Retrieve `_m365_sync_retry_count` from payload (defaults to `0`).
    - Check if user exists. If not:
      - If `_m365_sync_retry_count < 3`:
        - Increment the count in the payload.
        - Add a log in the DB and terminal stating the user is not found and the check is rescheduled.
        - Reschedule the job using the scheduler: `sync_queue.enqueue_in(timedelta(minutes=2), "tasks.sync_user.run_m365_license_task", job_id, payload)`.
        - Raise `M365UserNotSyncedError` to exit silently.
      - If `_m365_sync_retry_count >= 3`:
        - Raise a standard `Exception` with a clear message indicating that the user was not found in Azure AD after 3 scheduler retries (4 total attempts).
    - If user exists:
      - Call `set_usage_location(upn, "TH")`.
      - Run a verification loop: Call `get_user_usage_location(upn)` up to 5 times, sleeping 3 seconds between attempts.
      - Break the loop once the usage location is verified as `"TH"`.
      - Call `assign_licenses` to assign the licenses.
- **Verify**:
  - Run the test script to verify successful execution:
    ```bash
    python temp/test_m365_step.py
    ```

## Risks & mitigations
- **Risk**: The Graph API could return transient errors during verification.
- **Mitigation**: The verification loop catches exceptions and treats them as `None`, logging a warning but proceeding to assign licenses as a fallback if the loop completes without verification.

## Rollback plan
- Revert changes via git:
  ```bash
  git checkout -- worker/services/m365_service.py worker/tasks/sync_user.py
  ```
