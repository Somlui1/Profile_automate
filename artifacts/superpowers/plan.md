# AI-Friendly Architecture Restructuring Plan

## Goal
To clean up the workspace by removing temporary/legacy files and establish a set of modular `ARCHITECTURE.md` files. This will provide future AI agents with strict context boundaries, clear data flow rules, and instructions on how to extend the system without hallucinating or breaking existing code.

## Assumptions
- The `temp/` folder contains only temporary migration/refactoring scripts that are no longer needed in production.
- `frontend-old/` was already removed previously.
- Markdown files will focus on "Concepts & Rules" rather than line-by-line documentation.

## Plan

### Step 1: Ignore Temp Directory (AI & Git)
- **Files**: `.gitignore`, `.agentignore`
- **Change**: Keep the `temp/` directory locally, but append `temp/` to `.gitignore` so it isn't tracked by Git, and create/append it to `.agentignore` so that AI models automatically ignore the directory to save tokens and avoid scanning obsolete scripts.
- **Verify**: Verify that `temp/` is listed in `.gitignore` and `.agentignore`.

### Step 2: Root Context (`ARCHITECTURE.md`)
- **Files**: `ARCHITECTURE.md` (Root)
- **Change**: Create a top-level architecture file explaining the 3-tier architecture (FastAPI API, RQ Worker, React Frontend) and the rule of "Zero-Change Frontend" using `steps_schema.json`.
- **Verify**: File exists and is readable.

### Step 3: API Architecture Context
- **Files**: `api/ARCHITECTURE.md`
- **Change**: Create documentation explaining the FastAPI routing structure, how it accesses SQLite, and how the Server-Sent Events (SSE) `/stream` endpoint relays Redis queue messages.
- **Verify**: File exists and is readable.

### Step 4: Worker Architecture Context
- **Files**: `worker/ARCHITECTURE.md`
- **Change**: Create documentation explaining the RQ job loop, the pipeline execution inside `tasks/sync_user.py`, and how metadata/statuses are pushed back to the API via `job_logs`.
- **Verify**: File exists and is readable.

### Step 5: Frontend Architecture Context
- **Files**: `frontend/ARCHITECTURE.md`
- **Change**: Create documentation explaining the Vite/React architecture, Tailwind styling, and explicitly mapping the rule that UI components must dynamically render based on API schemas rather than hardcoded states.
- **Verify**: File exists and is readable.

## Risks & mitigations
- **Risk**: Overwhelming the workspace with Markdown.
  - **Mitigation**: Keep the `ARCHITECTURE.md` files short (under 50 lines) and strictly focused on system boundaries.
- **Risk**: `.agentignore` syntax might vary between tools.
  - **Mitigation**: Use standard gitignore-style wildcard matching which is universally supported.

## Rollback plan
- Delete the `temp/` entry from `.gitignore` and `.agentignore`.
- Delete the created `ARCHITECTURE.md` files.
