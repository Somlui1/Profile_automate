## Goal
Enable double-click folder navigation inside the main AD Explorer list view (`ADExplorerTab.tsx`), allowing users to double-click an OU, container, or domain to open it, list its children, and automatically expand all parent folders in the left sidebar console tree.

## Assumptions
- Custom and standard container object types are `ou`, `container`, and `domain`.
- React state `selectedOUDn` and `expandedOUs` are the sources of truth for list navigation and sidebar tree expansion.

## Plan

### Step 1: Implement Double-Click Navigation & Tree Expansion Sync in `ADExplorerTab.tsx`
- **Files**: [ADExplorerTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/ADExplorerTab.tsx)
- **Change**:
  - Update `handleRowDoubleClick` to detect if the double-clicked item is of type `ou`, `container`, or `domain`.
  - If so, update `selectedOUDn` to the item's `dn` and clear `selectedRowIndex`.
  - Parse the item's DN hierarchy (using non-escaped comma regex split) to recursively resolve all parent OUs, and merge them as expanded (`true`) in the `expandedOUs` state.
- **Verify**: Compile the frontend project using:
  `npx tsc --noEmit` inside `frontend/`

## Risks & mitigations
- **Risk**: DN path parsing using simple comma splits might break if OUs have escaped commas in their names.
- **Mitigation**: Use the regex `/(?<!\\),/` to split path components safely, avoiding splits on escaped commas.

## Rollback plan
- Revert the modifications to `ADExplorerTab.tsx` using `git checkout`.
