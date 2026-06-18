## Goal
Diagnose and resolve the `HTTP 400: Bad Request` error when assigning M365 licenses during Step 3 (`m365_license`) in the live `worker` task pipeline, ensuring stable and reliable license assignment.

## Constraints
- Do not introduce any emojis in the source code, comments, or log messages. Use clear text prefixes like `[INFO]`, `[WARNING]`, `[FAILED]`, `[SUCCESS]`.
- Must work seamlessly within the Docker worker environment (`worker-1`).
- Must handle the case of replication delays in MS Graph API where a newly created user or a recently modified user profile (e.g. `usageLocation`) is not immediately ready for license assignment.

## Known context
- Standalone script `temp/test_m365_step.py` executes successfully. This is likely because the user `aduc.test@aapico.com` had already been created, and the `usageLocation` had time to propagate in Azure AD before the manual script was run.
- During the live pipeline run, `m365_service.set_usage_location` is called, and `m365_service.assign_licenses` is invoked immediately afterwards. Since Azure AD replication is asynchronous, this immediate invocation often fails with an HTTP 400 error (e.g., if Azure AD has not fully propagated the `usageLocation` to all endpoints).
- The current implementation of `m365_service.py` handles exceptions generically under `except Exception as e:` and does not read/log the details of `urllib.error.HTTPError` responses (the Graph API returns a JSON body with a specific error message explaining why the request failed). This makes debugging difficult.
- In `worker/tasks/sync_user.py`, the licenses defaults to `STANDARDPACK` if the department is not "engineering". If the tenant does not have `STANDARDPACK` licenses or the ID is incorrect for this tenant (which uses `ENTERPRISEPACK`), the assignment will fail with HTTP 400.

## Risks
- **Graph API Replication Delay**: Azure AD can take a few seconds to a few minutes to propagate `usageLocation` updates. Immediate assignment will fail if not retried or delayed.
- **Incorrect License SKU Configuration**: If the tenant lacks the specified SKU (e.g., `STANDARDPACK` vs `ENTERPRISEPACK`), the API will return HTTP 400 permanently.
- **Hidden Graph API errors**: Without extracting the HTTP error response body, we might miss other causes of HTTP 400 (e.g. out of license seats, invalid user status).

## Options (2–4)

### Option 1: Enhance Graph API Error Handling to Log Details
Modify `worker/services/m365_service.py` to specifically catch `urllib.error.HTTPError`, read the error response body (`e.read().decode('utf-8')`), parse the JSON message, and log/raise the detailed Graph API error description. 
- *Pros*: Exposes the exact root cause of any Graph API error in the logs immediately, resolving the lack of visibility.
- *Cons*: Does not solve the replication delay by itself, but makes diagnosing it easy.

### Option 2: Introduce a Wait Delay and Retry Logic in Step 3
Add a retry loop or short delay (e.g., 5-10 seconds) between setting the `usageLocation` and assigning the license, or catch license assignment failures and retry up to 3 times with backoff if the error indicates a propagation delay (e.g., missing usage location).
- *Pros*: Directly addresses the asynchronous replication delay of `usageLocation` in Azure AD.
- *Cons*: Might slightly increase job execution time (by a few seconds) during normal runs.

### Option 3: Standardize the Default/Configurable License Assignment
Update the payload normalization in `worker/tasks/sync_user.py` to ensure the correct default SKU is assigned, and log the SKUs being assigned before invoking the API.
- *Pros*: Prevents issues where users are assigned invalid SKUs (like `STANDARDPACK` when only `ENTERPRISEPACK` is available in the tenant).
- *Cons*: Requires understanding which licenses are active in the target tenant.

## Recommendation
Implement a combination of Option 1 and Option 2:
1. **Expose error details**: Update `worker/services/m365_service.py` to catch `urllib.error.HTTPError`, read the error response body, and log it.
2. **Handle replication delay**: Add a retry mechanism or a short delay (e.g., sleep 5-10 seconds) when assigning licenses in `_execute_m365_license` or `assign_licenses`, and log the SKUs being assigned.

## Acceptance criteria
1. Failed Graph API requests log the detailed HTTP error body from Microsoft Graph.
2. Step 3 does not fail due to a temporary Azure AD replication delay of `usageLocation`.
3. The exact SKUs being assigned are clearly printed in the worker log before calling `assign_licenses`.
4. No emojis are used in the modified codebase or log strings.
