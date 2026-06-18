## Goal
Optimize the Microsoft 365 license assignment workflow in the worker tasks to handle `usageLocation` replication delays gracefully without producing noisy false-positive `ERROR` logs.

## Constraints
- Do not introduce Unicode emojis in the codebase (logs, comments, and print statements).
- Keep changes minimal and scoped.
- Minimize thread blocking where possible, but small safe sleeps are acceptable since this is a background worker task.

## Known context
- Currently, when `usageLocation` is set to `"TH"`, we verify it via the `/users/{upn}?$select=usageLocation` Graph API endpoint.
- Once the user query returns `"TH"`, the worker immediately proceeds to call `assign_licenses` (usually within < 1 second).
- However, the internal M365 licensing database has a separate replication pipeline. It often lags behind the main user profile directory service by 3 to 10 seconds.
- As a result, the first `assign_licenses` call frequently fails with `HTTP Error 400: Bad Request - License assignment cannot be done for user with invalid usage location.`, which prints an error stack trace to the logs before succeeding on the next retry attempt 5 seconds later.

## Risks
- **Noisy Logs & False Alarms**: Continuous `ERROR` logging in production for expected transient conditions (like 5-second replication lag) creates noise for log monitors (e.g. Datadog, ELK) and might trigger false alerts.
- **Worker Thread Blocking**: Adding too large of a synchronous sleep (e.g., `time.sleep(15)`) blocks the worker thread from processing other tasks in the queue.

## Options (2–4)

### Option 1: Keep current flow (Status Quo)
Let the first attempt fail, log the `ERROR` stack trace, and rely on the existing 3-attempt retry loop with progressive backoff (5s, 10s).
- *Pros*: Zero code changes. Already robustly succeeds on retry.
- *Cons*: Log noise. Monitoring systems see `ERROR: Failed to assign M365 licenses... HTTP Error 400` and might trigger alerts even though the task succeeds 5 seconds later.

### Option 2: Add a short, post-verification sleep (Recommended)
After verifying `get_user_usage_location(upn) == "TH"`, introduce a short 5-second sleep (`time.sleep(5)`) *before* the first `assign_licenses` call. This gives the licensing subsystem time to synchronize.
- *Pros*: Extremely simple to implement. Prevents almost all HTTP 400 errors from occurring, keeping production logs clean.
- *Cons*: Adds a 5-second synchronous delay to the worker task, but since this task is already delayed by minutes via the scheduler, a 5-second delay is negligible.

### Option 3: Suppress the initial error log for known replication errors
Modify `Microsoft365Service.assign_licenses` or the error catcher in `_execute_m365_license` so that if the error message contains `"invalid usage location"`, it logs it as a `WARNING` on initial attempts, and only logs an `ERROR` if all retries are exhausted.
- *Pros*: Avoids sleeping if replication is instant. No unnecessary delay.
- *Cons*: More complex code logic inside `m365_service.py` to count attempts or pass a flag indicating if it's the final retry.

## Recommendation
Implement **Option 2**. Adding a simple `time.sleep(5)` immediately after verifying `usageLocation` is set to `"TH"` is the most robust and simplest way to avoid log noise without adding complexity to the API interaction code. It ensures that when we call `assign_licenses`, the licensing subsystem is highly likely to be ready.

## Acceptance criteria
1. If `usageLocation` is verified, sleep for 5 seconds before the first `assign_licenses` attempt.
2. The logs should remain clean of `HTTP Error 400` errors for usage location propagation under normal conditions.
3. No emojis are used in the modified code.
