# Implementation Plan - UI Optimization & Navigation Enhancements

1. **Remove Directory & Sync Dashboard**: Clean up the legacy dashboard, set the default route/tab to PDF Auto-Provision (`pdf-provision`), and remove references to `DashboardTab`.
2. **Implement Back/Forward History in OU Select**: Add a historical navigation stack to the `ADUCTree` component toolbar so users can navigate back and forward through visited OU directories.
3. **Simplify Step 2.5 to show only Raw JSON**: Remove tabs from the Step 2.5 debug preview, display only the raw JSON payload with clean formatting, and add a quick "Copy JSON" button.

## Proposed Changes

### [Dashboard Tab Removal]
- **Modify** `frontend/src/App.tsx`:
  - Change default `currentTab` state to `'pdf-provision'`.
  - Remove imports and references to `DashboardTab`.
- **Delete** `frontend/src/components/DashboardTab.tsx`.

### [ADUC Tree Navigation]
- **Modify** `frontend/src/components/ADUCTree.tsx`:
  - Implement `history` (array of DN strings) and `historyIndex` state.
  - Sync parent-triggered or tree-click changes to `selectedDN` with the history stack.
  - Implement `handleBack` & `handleForward` handlers to traverse the stack.
  - Remove `disabled` attribute from Back/Forward buttons and hook them to the handlers.

### [PDF Provisioning Debugger]
- **Modify** `frontend/src/components/PDFProvisionTab.tsx`:
  - Remove `debugTab` state.
  - Remove the tabs button layout in Step 2.5.
  - Render only the raw JSON stringified content (`buildProvisionPayload()`) inside a clean dark code viewer.
  - Add a "Copy JSON" button to copy the payload.
