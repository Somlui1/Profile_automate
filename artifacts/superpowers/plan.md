## Goal
Preserve PDFProvisionTab form state across tab switches by adopting **Zustand** global state management ? the most sustainable, debuggable, and future-proof approach (Option 2 from brainstorm). Also update all relevant documentation (README, ARCHITECTURE files).

## Assumptions
- PDFProvisionTab has ~45 local `useState` variables that need to be migrated.
- No other tabs (JobQueueTab, M365Tab, ADExplorerTab, SettingsTab) require state persistence at this stage ? only PDFProvisionTab is affected.
- The `zustand` npm package (~1.5kB gzipped) is acceptable as a new dependency and will not bloat the vendor chunk.
- Vite's `manualChunks` in `vite.config.ts` may need a small update to include `zustand` in the vendor chunk.
- The `useRef` variables (`scrollRef`, `eventSourceRef`, `fileInputRef`) will **remain local** in the component because refs are DOM-bound and should not be globalized.
- Side-effect hooks (`useEffect` for SSE, license fetch, debounced manager verification) will remain inside the component and read from the store instead of local state.

## Plan

### Step 1 ? Install Zustand
**Files:** `frontend/package.json`
**Change:** Run `npm install zustand` inside the `frontend/` directory.
**Verify:** `grep zustand frontend/package.json` shows the new dependency.

---

### Step 2 ? Create the Zustand Store file
**Files:** `frontend/src/stores/provisionStore.ts` [NEW]
**Change:** Create a new file with a Zustand store that contains:
  - All ~45 state variables currently declared via `useState` in PDFProvisionTab (lines 106?199).
  - Setter actions for each variable (matching current setter names like `setFirstName`, `setLastName`, etc.).
  - A `resetForm()` action that resets all form fields back to initial defaults (useful when a job is submitted successfully and the form needs clearing).
  - Group the state into logical slices using comments: Step1 State, Step2 Form State, Step2 Licenses, Step2 AD Groups, Step2 Modals, Step3 Pipeline.
  - Export a typed `useProvisionStore` hook.
**Verify:** `npx tsc --noEmit` passes with no type errors in the new file.

---

### Step 3 ? Refactor PDFProvisionTab to consume the store
**Files:** `frontend/src/components/PDFProvisionTab.tsx` [MODIFY]
**Change:**
  - Remove all ~45 `useState` declarations (lines 106?199).
  - Replace with a single destructured call: `const { firstName, setFirstName, ... } = useProvisionStore();`
  - Keep `useRef` declarations (`scrollRef`, `eventSourceRef`, `fileInputRef`) as local refs ? these are DOM-specific.
  - Keep all `useEffect` hooks and handler functions in place ? they will simply read/write via the store setters instead of local state setters.
  - The component signature (props) stays exactly the same.
**Verify:** `npx tsc --noEmit` passes. Build with `npm run build` to confirm no runtime chunk errors.

---

### Step 4 ? Update App.tsx tab rendering (CSS hidden approach as safety net)
**Files:** `frontend/src/App.tsx` [MODIFY]
**Change:** As an additional safety net and performance bonus, change the tab rendering from conditional mounting (`{currentTab === 'pdf-provision' && <PDFProvisionTab />}`) to CSS-based hiding using wrapper divs:
  - `<div className={currentTab === 'pdf-provision' ? 'block' : 'hidden'}><PDFProvisionTab .../></div>`
  - Apply the same pattern to all tabs for consistency.
  - This is a **belt-and-suspenders** approach: Zustand preserves state even if the component unmounts, and CSS hidden prevents unmount entirely. Together they provide the most robust experience.
**Verify:** Open the app in the browser, fill out PDFProvisionTab form, switch tabs, switch back ? all form data persists.

---

### Step 5 ? Update Vite config for vendor chunking
**Files:** `frontend/vite.config.ts` [MODIFY]
**Change:** Add `zustand` to the `manualChunks.vendor` array so it ships with other framework code instead of as a separate chunk.
**Verify:** `npm run build` ? check that `dist/assets/vendor-*.js` includes zustand and total chunk size increase is < 3kB.

---

### Step 6 ? Update frontend/ARCHITECTURE.md
**Files:** `frontend/ARCHITECTURE.md` [MODIFY]
**Change:** Add a new section (Section 5) titled **"State Management (Zustand)"** documenting:
  - Why Zustand was chosen (lightweight, no boilerplate, devtools support).
  - The store file location (`src/stores/provisionStore.ts`).
  - The convention: Form-heavy tabs use Zustand stores; simple tabs may keep local state.
  - The `resetForm()` pattern for clearing state after job submission.
**Verify:** File renders correctly as markdown.

---

### Step 7 ? Update root ARCHITECTURE.md
**Files:** `ARCHITECTURE.md` [MODIFY]
**Change:** Under the Frontend Tier bullet, add mention of Zustand for cross-tab state persistence.
**Verify:** File renders correctly as markdown.

---

### Step 8 ? Update README.md
**Files:** `README.md` [MODIFY]
**Change:**
  - In the Technology Stack > Frontend Client section, add `Zustand` as a bullet for state management.
  - In the Project Directory Structure, add `stores/` under `frontend/src/`.
**Verify:** File renders correctly as markdown.

---

### Step 9 ? Final integration test
**Files:** None (manual verification)
**Change:** None ? this is a verification-only step.
**Verify:**
  1. `npm run build` succeeds with no errors.
  2. Open the built app in a browser.
  3. Navigate to PDFProvisionTab, fill in several fields (name, email, department, etc.).
  4. Switch to Job Queue tab, then M365 tab.
  5. Switch back to PDFProvisionTab ? all fields retain their values.
  6. Submit a job and confirm `resetForm()` clears the form correctly.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Zustand store has a large surface (~45 variables) which could be error-prone during migration | Group variables into logical slices with TypeScript interfaces; use `npx tsc --noEmit` after each sub-step |
| `useEffect` hooks that depend on local state might behave differently with store state | Zustand state changes trigger re-renders identically to `useState`; no behavioral change expected |
| SSE `EventSource` ref cleanup on unmount won't fire if component stays mounted (CSS hidden) | The `useEffect` cleanup still runs on full page unload; for tab switches it's actually better that SSE stays alive |
| Vendor chunk size increase | Zustand is ~1.5kB gzipped ? negligible impact |
| Breaking the Zero-Change UI architecture | This change is purely frontend state management ? it does not touch the schema-driven rendering logic |

## Rollback plan
1. `git revert` the commits made during execution.
2. `cd frontend && npm uninstall zustand` to remove the dependency.
3. Delete `frontend/src/stores/provisionStore.ts`.
4. Restore `PDFProvisionTab.tsx` and `App.tsx` from git history.
5. `npm run build` to verify clean rollback.
