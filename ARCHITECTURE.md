# IT Provisioning Automate - Architecture

## System Overview
This project is an automated IT provisioning system with a **3-tier architecture**:

1. **API Tier (FastAPI)** (`/api`)
   - Handles REST requests from the Frontend.
   - Accesses the central `sqlite.db` database.
   - Exposes a Server-Sent Events (SSE) `/stream` endpoint to stream real-time logs from Redis to the frontend.

2. **Worker Tier (RQ & Redis)** (`/worker`)
   - Executes heavy, long-running provisioning tasks (Active Directory, Papercut, Microsoft 365, Email).
   - Reads the dynamic sequence from `steps_schema.json`.
   - Emits fine-grained logs back to the database and Redis queue which are consumed by the API.

3. **Frontend Tier (Vite/React)** (`/frontend`)
   - A **Zero-Change UI architecture**.
   - Components dynamically render based on `/api/v1/jobs/steps` (which serves `steps_schema.json`).
   - Uses Tailwind CSS and Lucide React (Explicitly mapped) for styling.

## AI Development Rules
- **Do not hardcode UI logic** for the workflow steps in React. Any new step must be added to `worker/steps_schema.json` and handled by the Python worker. The UI will render it automatically.
- **Ignore `temp/`**: Any one-off migration scripts should be placed in `temp/` which is ignored by Git and AI context.
- Follow specific module rules defined in `api/ARCHITECTURE.md`, `worker/ARCHITECTURE.md`, and `frontend/ARCHITECTURE.md`.
