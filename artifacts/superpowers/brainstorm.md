# Brainstorm: Comparison of test_m365_step.py vs PDFProvisionTab.tsx Payloads

## Goal
Understand why the payload enqueued via [test_m365_step.py](file:///c:/Users/wajeepradit.p/git/profile_automate/temp/test_m365_step.py) works perfectly, while the payload built in [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx) fails to add AD groups (even though the frontend UI shows group verification passed successfully).

## Constraints
- Align frontend payload structure exactly with what the backend API expects and what the python test script demonstrates.
- Must ensure that groups are mapped as an array of strings (`string[]`) rather than full objects to prevent backend type errors.

## Known context
### 1. Why [test_m365_step.py](file:///c:/Users/wajeepradit.p/git/profile_automate/temp/test_m365_step.py) works perfectly
The test script manually defines `REALISTIC_PAYLOAD` with the `groups` key placed **directly inside `custom_attributes`**:
`python
"custom_attributes": {
    ...
    "groups": [
        "AH IT",
        "CL200",
        "AAPICO Group VPN",
        ...
    ]
}
`
This matches the exact structure expected by the worker (`custom_attrs.get("groups")` as a list of strings).

### 2. Why [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx) fails
- **Verification passes in the UI**: The frontend successfully calls the API `/api/v1/user/groups/bulk-check` with a list of raw group names. The backend verifies their existence, returns them as `Found`, and the frontend stores them in the state array `adGroupsAssigned`. This is why the UI shows validation/verification passed successfully.
- **Payload construction is missing the field**: When generating the final API payload in `buildProvisionPayload()`, the frontend constructs `custom_attributes` but **completely omits the `groups` field**. 
- Therefore, the JSON body sent to `/api/v1/jobs/sync` contains no group information under `custom_attributes`, causing the worker to skip group assignment.

## Risks
- **Data Structure Discrepancy**: The React state `adGroupsAssigned` stores groups as objects: `[{ name: "Domain Users", scope: "Global", desc: "..." }]`. 
- If we pass `adGroupsAssigned` directly to the payload, the backend worker will receive a list of dictionaries. The Python LDAP library calls `"," in group` and `group.replace(...)`, which will throw a `TypeError` if `group` is a dictionary instead of a string. We must map it to strings: `adGroupsAssigned.map((g) => g.name)`.

## Options (2?4)
- **Option 1 (Recommended)**: Modify `buildProvisionPayload` in `PDFProvisionTab.tsx` to include `groups: adGroupsAssigned.map((g) => g.name)` inside `custom_attributes`.
  * *Pros*: Simple, safe, and replicates the exact structure used in `test_m365_step.py` which is known to work.
  * *Cons*: None.
- **Option 2**: Modify `ADProfileSchema` in `api/endpoints/user.py` to support `ad_groups` and translate it inside the backend.
  * *Pros*: Moves mapping logic to backend.
  * *Cons*: Unnecessarily complex, modifies the Pydantic schema, and introduces regression risk to the API endpoint.

## Recommendation
We recommend **Option 1**. It resolves the discrepancy immediately by making the frontend produce the same payload structure that `test_m365_step.py` uses.

## Acceptance criteria
1. In `PDFProvisionTab.tsx`, the `buildProvisionPayload()` helper contains:
   `javascript
   groups: adGroupsAssigned.map((g) => g.name)
   `
   inside `task_data.ad_profile.custom_attributes`.
2. The final JSON payload matches the structure of `test_m365_step.py`.
3. The provision pipeline adds the user to verified groups successfully.
