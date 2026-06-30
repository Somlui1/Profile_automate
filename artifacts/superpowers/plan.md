# Plan: Fix Internet Level Auto-Selection from PDF

## Goal
Resolve the issue where `Internet Level` is not auto-selected in Step 2 of the onboarding wizard after parsing a PDF (such as `temp/request.pdf`).

## Assumptions
- `web.level` in the raw PDF response contains the parsed internet level string (e.g. `"Level C"`, `"ระดับ C"`, `"C"`).
- Standard internet level choices are restricted to `'A'`, `'B'`, `'C'`, or `'D'`.
- The default option should be `'A'`.

## Plan

### Step 1: Update `mapLocalRawToADSchema` in `frontend/src/components/PDFProvisionTab.tsx`
- **Files:** [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change:**
  1. Extract and normalize `internet_type` from `web.level`.
  2. Inject `internet_type` into `task_data.ad_profile.custom_attributes`.
- **Verify:** Open file and inspect code changes.

### Step 2: Build and Verification
- **Files:** [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change:** Run compile command.
- **Verify:** Run `npm run build` in the `frontend/` directory to ensure no compilation errors.

## Risks & mitigations
- **Risk:** `web.level` has an unexpected format.
- **Mitigation:** Safe regex or substring scanning that checks for the characters 'A', 'B', 'C', or 'D' anywhere in the level string, defaulting to 'A' if no match is found.

## Rollback plan
- Revert the changes using `git checkout -- frontend/src/components/PDFProvisionTab.tsx`.
