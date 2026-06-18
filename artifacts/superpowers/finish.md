## Summary of Changes

### 1. Enhanced Microsoft Graph API Error Handling
- **Files**: [m365_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/m365_service.py)
- **Details**: 
  - Updated HTTP request wrappers in `_get_access_token`, `check_user_exists`, `set_usage_location`, `resolve_sku_ids`, and `assign_licenses` to catch `urllib.error.HTTPError` specifically.
  - Decoded and logged the full HTTP response body from the Graph API (`e.read().decode('utf-8')`) when raising exceptions to make debugging easy and display the exact root cause in the logs.
  - Eliminated potential console logging encoding errors by ensuring no Unicode emojis are present.

### 2. Log Licenses and Added Propagation Delay Retry Logic
- **Files**: [sync_user.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/tasks/sync_user.py)
- **Details**:
  - Added logging in `_execute_m365_license` that explicitly lists the targeted SKU IDs and names being assigned before invoking the API.
  - Wrapped `m365_service.assign_licenses` in a 3-attempt retry loop with progressive backoff delay (5s, 10s).
  - Configured the retry to trigger specifically when the exception matches the `LicenseAssignmentCannotBeDoneForUserWithNoUsageLocationSpecified` error string to handle Azure AD replication delays of the user's `usageLocation`.

## Verification Commands & Results

### 1. Syntax and Import Checks
- **Command**: `python -c "import sys; sys.path.append('worker'); from services.m365_service import m365_service; print('Import OK')"`
- **Result**: `Import OK` (Pass)

### 2. Standalone End-to-End Step Verification
- **Command**: `python temp/test_m365_step.py`
- **Result**: Pass
  ```text
  [RUNNING] m365_license: Checking if user aduc.test@aapico.com exists in Azure AD (attempt 1/7)
  [RUNNING] m365_license: User aduc.test@aapico.com found in Azure AD. Resolving SKUs and assigning licenses...
  [RUNNING] m365_license: Setting usageLocation to 'TH' for user aduc.test@aapico.com
  [RUNNING] m365_license: Assigning M365 licenses: ENTERPRISEPACK
  [SUCCESS] m365_license: Successfully assigned 1 M365 licenses to user aduc.test
  [PASS] M365 License Step Completed Successfully.
  ```

## Follow-ups & Manual Validation
- Monitor the docker logs (`worker-1`) during the next live user sync run. 
- If any other HTTP 400 Bad Request error occurs, the log will now print the exact Microsoft Graph JSON response explaining the failure, enabling immediate correction.
