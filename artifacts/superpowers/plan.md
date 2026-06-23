# Implementation Plan - Supervisor Email Auto-Mapping

## Goal
Improve the supervisor email guessing and auto-mapping functionality so that it automatically generates the correct format (`username + @aapico.com`, i.e., `firstname.l@aapico.com`) when a supervisor's name is entered or parsed, and seamlessly maps this to the "To" field of the Outlook SMTP welcome email preview.

## Assumptions
- The standard username format for AAPICO accounts is `firstname.l` (e.g. `Anek Phromsiri` -> `anek.p`).
- The "Supervisor Manager Email" input field in Step 2 of the form is bound to the `emailTo` state, which also controls the SMTP Welcome Mail Preview's "To" field.
- Automatically improving the guess format inside the existing `useEffect` will solve the default fallback mismatch (changing from `firstname@aapico.com` to `firstname.l@aapico.com`).

## Plan

### Step 1: Update Email Guessing Logic in PDFProvisionTab.tsx
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**: Replace the fallback guessing logic inside `useEffect` to construct `firstname.l@aapico.com` instead of just `firstname@aapico.com`.
  - Extract the first name and the first letter of the last name from `managerInput`.
  - Update `supervisorEmail` output logic.
- **Verify**: Inspect `PDFProvisionTab.tsx` around the changed lines.

### Step 2: Implement Auto-Verification lookup on Manager Input change
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**: Add an automatic trigger or improve `handleVerifyManager` to run when the PDF is parsed, so it automatically queries the LDAP AD backend to resolve the real supervisor email address and status badge, without requiring the admin to click the "Verify" button.
- **Verify**: Run `npm run lint` to ensure no syntax/type errors.

### Step 3: Run full bundle build
- **Files**: None
- **Change**: Run production bundle build `npm run build` in the `frontend` directory.
- **Verify**: The build command should complete successfully.

## Risks & mitigations
- **Risk**: Automatic background lookups on every keystroke could spam the AD backend.
- **Mitigation**: We will only trigger the automatic lookup when the manager name changes via PDF parsing (initial load) or manual input completion, rather than on every keystroke, or ensure the manual "Verify" button remains as the primary source of truth while the default fallback guess is corrected to `firstname.l@aapico.com`.

## Rollback plan
- Use Git to restore files to their pre-change state:
  `git checkout -- frontend/src/components/PDFProvisionTab.tsx`
