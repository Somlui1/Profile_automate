## Summary of Changes

### 1. Retrieve usageLocation from Microsoft Graph
- **Files**: [m365_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/m365_service.py)
- **Details**:
  - Imported `Optional` from the `typing` module to support type annotations.
  - Implemented the `get_user_usage_location` method to perform a `GET` query to `https://graph.microsoft.com/v1.0/users/{upn}?$select=usageLocation` and parse the current `usageLocation` value.
  - Added mock mode compatibility returning `"TH"`.

### 2. Scheduler-based Sync Checking and Verification Loop
- **Files**: [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
- **Details**:
  - Replaced the exponential delay logic with a fixed 2-minute delay check using the RQ scheduler (`sync_queue.enqueue_in`).
  - Added state tracking using the `_m365_sync_retry_count` payload variable. If the user is still not found after 3 scheduler retries (4 total checks), a standard `Exception` is raised, causing the job to fail and cleanly log the diagnostic details in the database and console.
  - Implemented a 5-attempt verification loop (3-second delay between checks) to fetch and verify that `usageLocation` is set to `"TH"` prior to starting license assignment.
  - Expanded the license assignment propagation exception matcher to dynamically detect `"usage location"` (case-insensitive) in addition to `"usagelocationspecified"` within the Graph API error body.

## Verification Commands & Results

### 1. Compilation & Import Verification
- **Command**: `python -c "import sys; sys.path.append('worker'); from services.m365_service import m365_service; print('Import OK')"`
- **Result**: `Import OK` (Pass)

### 2. Standalone End-to-End Step Verification
- **Command**: `python temp/test_m365_step.py`
- **Result**: Pass
  ```text
  [RUNNING] m365_license: Checking if user aduc.test@aapico.com exists in Azure AD (attempt 1/4)
  [RUNNING] m365_license: User aduc.test@aapico.com found in Azure AD. Resolving SKUs...
  [RUNNING] m365_license: Setting usageLocation to 'TH' for user aduc.test@aapico.com
  [RUNNING] m365_license: Verified usageLocation set to 'TH'
  [RUNNING] m365_license: Assigning M365 licenses: ENTERPRISEPACK
  [SUCCESS] m365_license: Successfully assigned 1 M365 licenses to user aduc.test
  [PASS] M365 License Step Completed Successfully.
  ```

## Follow-ups & Manual Validation
- Run `docker-compose restart worker` to reload the new task logic in the docker worker container.
- Monitor the container logs during the next live user sync to observe the new scheduler rescheduling logs and the usage location verification loop output.
