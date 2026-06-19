## Goal
Enable real PDF file drag-and-drop and click-to-upload functionality inside the IT Resource Request provisioning panel (`PDFProvisionTab.tsx`), linking it directly to the backend's `/api/v1/parse/file` multipart parser endpoint.

## Assumptions
- The backend `/api/v1/parse/file` endpoint accepts a `file` field via `multipart/form-data` and outputs the extracted JSON document structure.
- We can load the Windows Tahoma or local TrueType fonts to generate the PDFs for manual/automatic testing.

## Plan

### Step 1: Add Drop State & File Ref in `PDFProvisionTab.tsx`
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**:
  - Add `isDragging` state variable (`useState<boolean>(false)`).
  - Add `fileInputRef` (`useRef<HTMLInputElement>(null)`).

### Step 2: Implement Local PDF Upload Parser Handler in `PDFProvisionTab.tsx`
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**:
  - Implement `handlePDFFileProcess(file: File)` to validate the file extension (must end with `.pdf`).
  - Send the file as a `multipart/form-data` payload containing the `file` key to the `/api/v1/parse/file` REST endpoint.
  - Parse the JSON response, map the fields using `mapLocalRawToADSchema`, and populate the state using `populateFormFromExtractedMap`.

### Step 3: Update Dropzone UI inside `PDFProvisionTab.tsx`
- **Files**: [PDFProvisionTab.tsx](file:///c:/Users/wajeepradit.p/git/profile_automate/frontend/src/components/PDFProvisionTab.tsx)
- **Change**:
  - Bind drag over, drag leave, and drop events (`onDragOver`, `onDragLeave`, `onDrop`) to the upload area.
  - Add a hidden file input element linked to the click event on the dropzone.
  - Render dynamic styling for the active drag state (subtle scaling, glow, border highlight) to provide an premium experience.

### Step 4: Verification
- **Verify**: Run `npx tsc --noEmit` and `npm run build` in the `frontend` folder to ensure clean compilation.

## Risks & mitigations
- **Risk**: User drops an invalid or corrupted file type.
- **Mitigation**: Validate the extension client-side (`endsWith('.pdf')`) and wrap the fetch in a try/catch block with clear toast alerts.
