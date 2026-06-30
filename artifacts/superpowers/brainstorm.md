## Goal
Preserve the form data and state in the PDFProvisionTab when the user navigates away to other tabs and returns.

## Constraints
- PDFProvisionTab has a massive amount of local state (useState).
- Tab switching in App.tsx completely unmounts the previous tab component, wiping its local state.
- Must not significantly increase the complexity of App.tsx or PDFProvisionTab.tsx.
- Must perform reasonably fast without causing re-renders across tabs unnecessarily.

## Known context
- Tab switching logic is in App.tsx (currentTab).
- PDFProvisionTab component manages state locally (useState).
- When a user changes tabs, the component is unmounted and local state is lost.

## Risks
- Moving all state to App.tsx (Lifting state up) will make App.tsx very messy because PDFProvisionTab has a very large number of state variables.
- Caching to localStorage / sessionStorage might fail for non-serializable objects (like File objects if any exist), though most states here are simple strings/booleans.
- Using CSS to hide tabs instead of unmounting them keeps all tabs mounted in the DOM. This can increase background memory usage and cause performance hits if other tabs have heavy background polling.

## Options (2-4)
1. CSS Display / Hidden instead of Unmounting (Simplest): In App.tsx, instead of conditionally rendering PDFProvisionTab (e.g. {currentTab === 'pdf-provision' && <PDFProvisionTab />}), render all tabs and use className={currentTab === 'pdf-provision' ? 'block' : 'hidden'}. This keeps the component mounted in the DOM, so React retains its state natively.
2. Global State Management (Zustand): Implement a lightweight global store like zustand. Move all form variables into the store. This cleanly separates the state from the UI component and prevents App.tsx bloat, but requires refactoring all useState calls in PDFProvisionTab.
3. Lift State Up to Context: Create a PDFProvisionContext wrapping the tabs, so the state lives outside the tab components. When the tab unmounts, the state in the Context remains. When it remounts, it re-hydrates from Context. Requires a lot of boilerplate.
4. Persist to sessionStorage (useStickyState): Replace useState with a custom hook that writes to sessionStorage on every change and reads from it on mount.

## Recommendation
Option 1 (CSS Hidden) is highly recommended if you want the fastest, non-invasive change. It requires modifying only App.tsx to conditionally apply display: none rather than unmounting the components. It instantly solves the state loss without having to rewrite dozens of useState lines in PDFProvisionTab.

If keeping all components mounted is too heavy (due to polling or memory), Option 2 (Zustand) is the recommended architectural approach, but will take more time to refactor.

## Acceptance criteria
- User can fill out form fields in PDFProvisionTab.
- User clicks another tab (e.g., Job Queue or M365).
- User clicks back to the PDF provision tab.
- All form data in PDFProvisionTab remains exactly as they left it.
