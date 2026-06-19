## Goal
Fix duplicate code in `ADExplorerTab.tsx` and implement a backend API for the new MMC-style ADUC interface to allow real, direct user creation in Active Directory.

## Assumptions
- The frontend uses `fetch` to communicate with the `/api/v1/user` backend routes.
- The `ad_service` module can handle synchronous user creation via `ad_service.create_user`.
- The new `ADExplorerTab` component added by the user (lines 1583-3165) is the correct version to keep, and the old one (lines 1-1582) should be removed.

## Plan
### Step 1: Remove Duplicate Component Code
- **Files**: `frontend/src/components/ADExplorerTab.tsx`
- **Change**: Delete the old component implementation (lines 1 to 1582) so that only the new `ADExplorerTab` component and its interfaces remain.
- **Verify**: Run `npx tsc --noEmit` inside `frontend/` to ensure there are no duplicate export errors.

### Step 2: Implement Backend API Endpoint
- **Files**: `api/endpoints/user.py`
- **Change**: Add a new Pydantic schema `ADCreateUserDirectSchema` matching the frontend's `newUserForm` fields (firstName, lastName, logonName, description, dept, title, password, employeeId, ou). Add a new `POST /ad/create-direct` route that calls `ad_service.create_user` with these mapped details.
- **Verify**: Run `python -m py_compile api/endpoints/user.py`.

### Step 3: Wire Frontend to API
- **Files**: `frontend/src/components/ADExplorerTab.tsx`
- **Change**: Modify `handleCreateUserSubmit` to make a `POST` request to `/api/v1/user/ad/create-direct` using the form data. Only append the new `ADObject` to the local state (`setAdObjects`) if the API request succeeds.
- **Verify**: Run `npx tsc --noEmit` inside `frontend/` to ensure type correctness.

## Risks & mitigations
- **Risk**: Active Directory fails to create the user due to password complexity rules or duplicate accounts.
- **Mitigation**: The frontend will catch the non-200 response and display an error toast instead of falsely updating the UI state.

## Rollback plan
- Revert `ADExplorerTab.tsx` and `api/endpoints/user.py` via Git to undo the endpoint integration and restore the duplicate code block if needed.
