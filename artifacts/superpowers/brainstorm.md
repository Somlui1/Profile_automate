# Brainstorm: Enable Real PDF Drag-and-Drop in PDFProvisionTab

## Goal
Enable real PDF file drag-and-drop and click-to-upload support in `PDFProvisionTab.tsx` so users can upload actual IT Resource Request PDFs and parse them on the backend via the `/api/v1/parse/file` endpoint.

## Constraints
- Must maintain all existing parsing, logging, and toast hooks.
- Zero-change to current layout styles unless adding drag-state styling.
- Prevent default browser behaviors (such as opening the dropped PDF in a new tab).

## Options
- **Option 1**: Use a third-party library like `react-dropzone`.
  - *Con*: Introduces a new dependency which might cause version mismatch or size bloat.
- **Option 2**: Implement native HTML5 Drag and Drop APIs inside React, utilizing state for the active drag visual cues and a hidden `<input type="file">`.
  - *Pro*: Native, lightweight, fully control styling and scale/glow transitions.

## Recommendation
- **Option 2** is recommended because it is lightweight, keeps package sizes small, and allows tailored Windows/Tailwind styling transitions.

## Acceptance Criteria
1. Dragging a file over the card area shows a visual highlight (e.g. highlight borders, scale up slightly).
2. Dropping a `.pdf` file triggers backend parsing via `api/v1/parse/file` and populates the form inputs with extracted employee details.
3. Clicking the dropzone area triggers the browser's native file picker to select a PDF.
4. Dropping non-PDF files triggers a warning toast and halts.
