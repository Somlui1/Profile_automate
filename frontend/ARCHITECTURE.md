# Frontend Architecture (React / Vite)

## Role
This directory contains the user interface of the Provisioning system. It connects to the FastAPI backend via HTTP REST endpoints and Server-Sent Events (SSE).

## Key Concepts

### 1. Zero-Change Frontend Rule
- **NEVER hardcode provisioning steps** in the React UI (e.g., do not write `const steps = ['AD', 'Papercut']`).
- The frontend must retrieve its rendering instructions from `/api/v1/jobs/steps` and store them in `stepsSchema`.
- Map over `stepsSchema` to render cards, queues, and progress bars. If a new step is added to the backend schema, the UI must automatically render it without a recompile.

### 2. Explicit Icon Mapping
- Do **not** use `require('lucide-react')` or dynamic wildcard imports for icons. Doing so breaks Tree-Shaking and bloats the `vendor.js` chunk size to >500kB.
- Use the `ICON_MAP` dictionaries provided in `PDFProvisionTab.tsx` and `JobQueueTab.tsx`. If a new icon is needed by the schema, explicitly `import` it at the top of the file and add it to the map.

### 3. Server-Sent Events (SSE)
- Real-time logging relies on `EventSource`.
- The event listeners (`step_update`) parse the `metadata` JSON payload to update the `pipelineSubStates` dynamically, driving the loading indicators on the checklist items.

### 4. Build System (Vite)
- The build uses `manualChunks` in `vite.config.ts` to separate `react`, `react-dom`, and `lucide-react` into a `vendor` chunk. Keep an eye on chunk sizes when importing heavy NPM packages.
