# Implementation Plan - SSE for Job Queue, Cancel/Pause/Delete Features, and UI Cleanup

## Goal
Implement full support for job cancellation, pausing/resuming, and deletion in the job queue. Optimize the job queue updates by replacing client-side Polling with Server-Sent Events (SSE). Clean up the Job Queue footer by removing the "IT worker Cluster status" UI section.

## User Review Required
> [!IMPORTANT]
> - Jobs can only be deleted if they are in a terminal state (`success`, `failed`, `cancelled`).
> - A new SSE endpoint `/api/v1/jobs/stream` will query SQLite database for changes every 1 second and stream the full jobs list when any job `updated_at` changes.

## Assumptions
- Browser support for `EventSource` is available.
- Deleting a job will also delete its logs in SQLite.

## Plan

### Step 1: Add DB Function to Delete Jobs
- **Files**: [database.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/core/database.py)
- **Change**: Implement `delete_job(job_id: str)` to remove the job from `jobs` and its logs from `job_logs`.
- **Verify**: Run unit tests or a quick Python script to verify job deletion.

### Step 2: Implement SSE stream and DELETE endpoints
- **Files**: [jobs.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/endpoints/jobs.py)
- **Change**:
  - Implement `@router.get("/stream")` before the `@router.get("/{job_id}")` endpoint to stream the updated jobs list to the frontend using `EventSourceResponse`.
  - Implement `@router.delete("/{job_id}")` which validates that the job is in a terminal state before calling `delete_job(job_id)`.
- **Verify**: Fetch the `/api/v1/jobs/stream` route using curl/python and verify it streams output. Test the `DELETE` API.

### Step 3: Connect Frontend to SSE stream and support delete
- **Files**: [App.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/App.tsx)
- **Change**:
  - Replace the 4-second interval polling with an `EventSource` connection to `/api/v1/jobs/stream` to receive real-time jobs list updates.
  - Update `handleControlJob` type to support `'delete'`. If action is `'delete'`, send a `DELETE` request instead of `PATCH`.
- **Verify**: Make sure TypeScript compiler does not complain and the page connects successfully.

### Step 4: Render Delete Button and Remove Worker Cluster UI
- **Files**: [JobQueueTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/JobQueueTab.tsx)
- **Change**:
  - Update `JobQueueTabProps`'s `onControlJob` signature to accept `'delete'`.
  - Render a button with the `<Trash2>` icon next to the toggle detail button for completed, failed, or cancelled jobs. Bind it to `onControlJob(job.id, 'delete')`.
  - Remove the "IT worker Cluster status" container from the footer (and keep only the "Queue Latency" section, adjusting the grid/flex layout accordingly).
- **Verify**: Run the app, check that the "IT worker Cluster status" is gone, and verify that the trash button functions correctly to delete completed jobs.

## Risks & mitigations
- **Risk**: EventSource connection drops or gets blocked.
- **Mitigation**: Implement automatic fallback to standard polling if the SSE connection fails to establish or disconnects unexpectedly.

## Rollback plan
- Revert changes using `git checkout` on the modified files.
