# Implementation Plan - Sidebar Status Indicators, SSE Active UI, and Menu Cleanup

## Goal
1. Show real-time connection status for AD LDAP, Papercut, and MS Graph (Microsoft 365) in the Sidebar using dynamic polling of the Backend Status API.
2. Change the loading/spinning icon of active/running jobs in the Job Queue Tab to a custom indicator showing that the UI is connected and listening to the SSE stream.
3. Move the AD Explorer menu item to the "Management" section of the Sidebar, and remove the "Directory Dashboard" menu item completely.

## User Review Required
> [!NOTE]
> The Sidebar will query `/api/v1/debug/system/status` every 8 seconds in the background to fetch actual connectivity state of AD, Papercut, and Microsoft Graph.

## Open Questions
None.

## Proposed Changes

### [Frontend Components]

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/Sidebar.tsx)
- Add `useState` and `useEffect` to fetch backend status from `/api/v1/debug/system/status` every 8 seconds.
- Map the API response fields (`services.active_directory`, `services.papercut`, `services.microsoft_365`) to LDAP, Papercut, and new Microsoft Graph status badges.
- Remove "Directory Dashboard" button from the main panels section.
- Move "AD Explorer" button to the Management section under the "M365 Licenses" button.

#### [MODIFY] [JobQueueTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/JobQueueTab.tsx)
- Import the `Radio` icon from `lucide-react`.
- In `getStepStateStyle` for `'processing'` jobs, change the label to `'SSE Active'` and use the `<Radio>` icon with a pulse animation instead of `<Loader2 className="animate-spin">`.
- Update the Active Jobs stat card indicator to display "SSE Active" with a pulsing green dot and a `<Radio>` pulse icon.

## Verification Plan

### Automated Tests
None.

### Manual Verification
1. Open the app and verify the Sidebar shows real status labels (e.g., MOCK ACTIVE or LIVE CONNECTED) for AD LDAP, Papercut, and MS Graph instead of hardcoded labels.
2. Click menu links in Sidebar and confirm "Directory Dashboard" is gone, and "AD Explorer" is in the Management section.
3. Go to the Job Queue page, enqueue a job, and verify that running jobs display the pulsing `Radio` icon and "SSE Active" label instead of the spinning loader.
