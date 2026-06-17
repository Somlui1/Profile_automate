## Goal
Fix the issue where the `sync_user` pipeline stops after the `ad_creation` task by resolving AD validation failures. Specifically, align the `expected_props` object with `ad_user_details` so that the AD validation checks the actual values used to create the AD account.

## Assumptions
- `worker/tasks/sync_user.py` is the correct file handling AD creation and validation.
- `temp/mock_test_sync_user.py` accurately mimics the payload structure that causes the validation error.
- Updating `expected_props` to pull values from `ad_user_details` for missing `custom_attrs` will satisfy the AD validation check.

## Plan

### Step 1: Update AD Validation Expected Properties
- **Files**: `worker/tasks/sync_user.py`
- **Change**: Locate the `expected_props` dictionary inside the `_execute_ad_creation` function. Update the fallback values for `email`, `mobile`, `title`, `department`, `company`, and `employee_id` to use `ad_user_details` instead of empty strings (`""`).
  ```python
  "email": custom_attrs.get("email") or ad_user_details.get("email", ""),
  "mobile": custom_attrs.get("mobile") or ad_user_details.get("mobile_phone", ""),
  "title": custom_attrs.get("title") or ad_user_details.get("position", ""),
  "department": custom_attrs.get("department") or ad_user_details.get("department", ""),
  "company": custom_attrs.get("company") or ad_user_details.get("company", ""),
  "employee_id": custom_attrs.get("employee_id") or ad_user_details.get("employee_id", ""),
  ```
- **Verify**: Run `python temp/mock_test_sync_user.py` to execute the mock offline test. Confirm that the pipeline completes `run_ad_creation_task` successfully without validation exceptions and proceeds to print logs for the remaining tasks (PaperCut, M365, Email).

## Risks & mitigations
- **Risk**: Other properties in `expected_props` might still have mismatched fallbacks if `custom_attrs` lacks them, potentially causing other edge cases to fail.
- **Mitigation**: Using `.get("key", "")` on `ad_user_details` ensures we never encounter a `KeyError`. We can monitor logs closely for any other field validation failures.

## Rollback plan
- Revert the changes to `expected_props` in `worker/tasks/sync_user.py` back to their original state (using `or ""` for the affected fields).
