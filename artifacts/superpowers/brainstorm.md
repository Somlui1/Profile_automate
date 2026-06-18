## Goal
Redesign the Microsoft 365 licensing step (`m365_license` in `worker/tasks/sync_user.py`) to handle Azure AD sync checking (with a 2-minute retry loop up to 3 times, failing with clear DB and terminal logs if not found) and verify the `usageLocation` propagation before assigning licenses.

## Constraints
- Do not introduce any Unicode emojis in the codebase (logs, comments, and print statements).
- Integrate cleanly with the existing Redis Queue (`rq`) and worker structure.
- Do not block the worker thread synchronously for long periods (avoid 6-minute sleep blocks on the main thread).

## Known context
- If a user is newly created, it takes time for Azure AD Connect to sync the user to Azure AD.
- If we assign licenses immediately after setting `usageLocation` to `"TH"`, it fails with a 400 Bad Request because of a licensing database replication delay.
- The `rq` queue supports delayed task enqueuing via `sync_queue.enqueue_in(timedelta(minutes=2), ...)`.

## Risks
- **Worker Timeout**: Blocking the worker for 6 minutes (3 retries * 2 minutes) with `time.sleep` will exceed worker timeout limits and block other jobs in the queue.
- **Asynchronous Replication Delay**: Setting `usageLocation` is instant, but propagation is asynchronous. Verification must confirm it has replicated before proceeding.

## Options (2–4)

### Option 1: Synchronous Loop (Block Worker Thread)
Perform all checks synchronously inside the worker using `time.sleep(120)` for the sync checks and shorter sleep loops for `usageLocation` verification.
- *Pros*: Simple sequential code.
- *Cons*: Highly undesirable. Blocks the worker thread for 6+ minutes, halting the entire queue and risking job execution timeout.

### Option 2: Asynchronous Re-enqueuing for Sync Check + Verification Loop for Usage Location (Recommended)
1. **User Sync Check**: 
   - Check if user exists. If not, re-enqueue the task using `sync_queue.enqueue_in(timedelta(minutes=2), ...)` and increment a retry counter in the payload (`_m365_sync_retry_count`).
   - Limit to 3 retries (4 attempts total). If still not found on the 4th attempt, raise a standard `Exception` (not `M365UserNotSyncedError`) to mark the job as failed, printing a clear message in the terminal and saving it to the database job log.
2. **Usage Location Verification**:
   - If user exists, call `set_usage_location(upn, "TH")`.
   - Implement `get_user_usage_location(upn)` in `m365_service.py` to retrieve the current `usageLocation` property.
   - Run a short verification loop (e.g. 5 attempts, sleeping 3 seconds each) verifying if `get_user_usage_location(upn) == "TH"`.
   - Once verified, log success and call `assign_licenses`. If verification fails after 5 attempts, log a warning and proceed to assign licenses (or retry with backoff).

## Recommendation
Implement **Option 2**. It leverages the asynchronous architecture of the queue (avoiding thread blocking for 2-minute intervals) and introduces a robust, verified, and reliable license assignment flow.

## Acceptance criteria
1. If the user is not in Azure AD, the task is re-queued with a 2-minute delay up to 3 times.
2. If the user is still not found after 3 retries (4 attempts total), the task fails, logging a clear error in the terminal and database.
3. Once the user is found, the worker sets `usageLocation` and verifies it via Graph API (up to 5 checks, 3s delay each) before assigning licenses.
4. No emojis are used in any modified or new code files.
