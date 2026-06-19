# Brainstorm: Enable Deep Nested Sub-OU Navigation in AD Explorer Tab

## Goal
Enable seamless navigation into deep nested sub-OUs and containers inside the main AD Explorer view (`ADExplorerTab.tsx`). Users should be able to double-click an OU or container in the data table to navigate into it, update the list view, and auto-expand its parent folders in the left sidebar Console Tree.

## Constraints
- Align with the existing navigation and selection states (`selectedOUDn`, `expandedOUs`).
- Ensure no regression on double-click behavior for Users and Groups.

## Known context
- **Current Limitation**: Double-clicking an OU or container in the list table displays a toast saying "Properties viewer is restricted to User and Group objects only" instead of navigating inside the folder.
- **Tree Expansion Syncing**: When navigating deep into sub-OUs via list view double-clicks, the left panel sidebar Console Tree should automatically expand all parent folders in the hierarchy to maintain visual sync.

## Risks
- Incorrectly parsing DN path parts to expand parents could cause rendering crashes if the DN has escaped commas.
- Mitigation: Parse parent DNs by splitting on commas not preceded by a backslash (`(?<!\\),` or standard split if regex isn't needed, but regex is safer).

## Options (2–4)
- **Option 1**: Allow double-clicking OUs in the list view to set `selectedOUDn`, but do not expand the parent chain in the left tree.
- **Option 2**: Allow double-clicking OUs to navigate (`selectedOUDn`), auto-expand the navigated OU, and recursively resolve and expand all parent DNs in the left tree to keep both views perfectly synchronized.

## Recommendation
- **Option 2**: Implement full double-click navigation for folders (`ou`, `container`, `domain`) in `ADExplorerTab.tsx`, and automatically expand the entire parent DN chain in the left sidebar.

## Acceptance criteria
1. Double-clicking an OU, container, or domain in the list table navigates into it and displays its contents.
2. The left-hand sidebar tree auto-expands to match the selected sub-OU, showing the complete parent hierarchy.
3. User and Group double-clicks continue to open the Properties Modal as expected.
