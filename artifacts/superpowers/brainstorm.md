# Superpowers Brainstorm: Supervisor Email Auto-Mapping in PDF Provision Tab

## Goal
Improve the UX for setting the Supervisor's email address in the "Outlook SMTP Delivery Welcome Mail Preview" ("To" field) by choosing between an auto-mapping approach or introducing a dedicated form field.

## Constraints
- Must remain intuitive for administrators using the PDF Auto-Provision page.
- Should utilize existing backend verification APIs (e.g., `/api/v1/user/ad/check-user`) if needed.
- The mail preview's "To" field should automatically and reliably default to the correct supervisor email address based on the parsed PDF file or the user's manual entry.

## Known context
- In [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx#L320-L329), the code guesses the supervisor's email address using `managerInput` string matching (looking for specific names like `anek`, `somsak`, `vipha`) or defaults to `first_name@aapico.com`.
- In [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx#L764-L770), clicking the "Verify" button next to the manager field makes a backend API call to query AD and, if found, sets the mail preview's `emailTo` field to `<supervisor_username>@aapico.com`.
- There is currently no explicit "Supervisor Email" field in the form section; it is only visible and editable in the Outlook preview panel at the bottom of the page.

## Risks
- **Desynchronization**: If the supervisor name is changed manually in the form, the email might not update automatically unless the user remembers to click the "Verify" button.
- **Form Clutter**: Adding too many input fields to the Bento Grid form might make the UI look cluttered.
- **Guessing Inaccuracy**: Relying solely on name-based guessing (`name@aapico.com`) can lead to invalid email addresses if the supervisor's actual AD logon name differs from their display name.

---

## Options

### Option 1: Add a visible "Supervisor Email" field in the Form (Recommended)
Add a "Supervisor Email" input field right next to or under the "Supervisor Manager" input in the form.
- **How it works**:
  - The PDF Parser mapping guesses or extracts the supervisor email and populates this field.
  - Clicking "Verify" next to the supervisor's name updates this email field with the verified AD username (`username@aapico.com`).
  - The user can edit the email directly in the form.
  - The Outlook Mail Preview "To" field binds directly to this field's state.
- **Pros**: Explicit, fully transparent, and allows direct manual adjustments without scrolling down to the Outlook preview.
- **Cons**: Adds one new input field to the Bento grid.

### Option 2: Enhanced Pure Auto-Mapping (Behind the Scenes)
Keep the form fields as they are, but automatically update the Mail Preview's "To" field whenever the "Supervisor Manager" name changes, without requiring a manual click on "Verify".
- **How it works**:
  - Add a debounce handler or dynamic lookup that runs whenever `managerInput` changes.
  - Guesses/looks up the username and sets `emailTo` state dynamically.
- **Pros**: Keeps the Bento Grid form clean without adding new fields.
- **Cons**: Less clear to the user why/how the email is determined until they scroll to the bottom preview; harder to correct if the automatic lookup guesses wrong without scrolling down.

---

## Recommendation
We recommend **Option 1**. Adding a visible "Supervisor Email" input field makes it extremely clear how the email mapping works. It allows the admin to verify, correct, or manually enter the supervisor's email right in the main organization details section, which naturally synchronizes down to the Outlook Preview.

---

## Acceptance criteria
1. A new "Supervisor Email" input field is added in the organization details form card of Step 2.
2. When parsing a PDF, this field is initialized using the guessed supervisor email or mapped supervisor details.
3. Clicking the "Verify" button on the Supervisor name updates this input field directly with the resolved AD email (`<username>@aapico.com`).
4. The Outlook Mail Preview "To" field is read-only or bi-directionally bound to this supervisor email input.
