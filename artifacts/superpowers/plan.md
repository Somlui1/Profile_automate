## Goal
Diagnose and resolve the `HTTP 400: Bad Request` error when assigning M365 licenses during Step 3 (`m365_license`) in the live `worker` task pipeline, ensuring stable and reliable license assignment.

## Assumptions
- The worker is running inside Docker.
- The credentials for Microsoft Graph API in `.env` are valid.
- The error is due to `usageLocation` propagation delay or invalid SKU IDs.

## Plan

### Step 1: Enhance Graph API Error Handling in `m365_service.py`
- **Files**: [m365_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/m365_service.py)
- **Change**: 
  - Update Graph API request methods to catch `urllib.error.HTTPError` specifically.
  - Read the response body (`e.read().decode('utf-8')`), log the detailed Graph API error message, and raise a descriptive exception containing this message.
  - Ensure no emojis are used in the logs or code.
- **Verify**: 
  - Run the test command:
    ```bash
    python -c "import sys; sys.path.append('worker'); from services.m365_service import m365_service; print('Import OK')"
    ```

### Step 2: Log Licenses and Add Propagation Delay Retry in `sync_user.py`
- **Files**: [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
- **Change**:
  - Add log output before assigning licenses showing exactly which SKUs and SKU IDs are being targeted.
  - Wrap the `assign_licenses` call in a retry loop (up to 3 attempts) with a short backoff delay (e.g. 5s, 10s) specifically if the exception indicates a missing `usageLocation` propagation error.
  - Ensure no emojis are used in logs or comments.
- **Verify**:
  - Run the standalone step test:
    ```bash
    python temp/test_m365_step.py
    ```

## Risks & mitigations
- **Risk**: The Graph API might return a different error message for usage location replication, or a permanent 400 error due to invalid SKU.
- **Mitigation**: The detailed error logging from Step 1 will expose the exact JSON response body in the worker logs, eliminating guessing.

## Rollback plan
- Discard changes using git:
  ```bash
  git checkout -- worker/services/m365_service.py worker/tasks/sync_user.py
  ```
