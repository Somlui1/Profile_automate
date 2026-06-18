# Profile Automate Project Structure

This document provides a brief overview of the project directory layout and component architecture.

```
profile_automate/
├── .agent/                    # Agent rules, workflows, and configuration
│   ├── rules/                 # Always-on agent behaviors and guidelines
│   ├── skills/                # Agent capability definitions
│   └── workflows/             # System workflows
├── api/                       # FastAPI backend server
│   ├── core/                  # Configurations, database connection, and base utilities
│   ├── endpoints/             # API Router endpoints (jobs, users, etc.)
│   ├── services/              # Shared services
│   ├── templates/             # HTML Templates (if any)
│   └── main.py                # Backend application entry point
├── worker/                    # RQ Worker background tasks
│   ├── core/                  # Worker configurations and SQLite database actions
│   ├── services/              # Active Directory, PaperCut, M365, and Health Check integration services
│   ├── tasks/                 # Decoupled pipeline steps (ad_creation, papercut_sync, etc.)
│   └── run.py                 # Worker process entry point
├── frontend/                  # React + Vite + TypeScript web application
│   ├── src/                   # React components, styles, and assets
│   ├── public/                # Static assets
│   └── package.json           # Frontend dependencies
├── docs/                      # Project documentation and specifications
│   ├── map_field.md           # Field mapping and transformation pipeline rules
│   └── note.md                # Notes and payload samples
├── temp/                      # Development utility scripts, temporary PDF templates, and mock tests
│   ├── AD.py                  # Standalone Active Directory LDAP validation script
│   └── mock_test_sync_user.py # Mock script to test user synchronization workflow locally
├── data/                      # Persistent storage (e.g. SQLite database)
├── .env                       # Environment configuration secrets (git-ignored)
└── dev.ps1                    # PowerShell script to spin up the local development environment
```

## Key Component Descriptions

1. **FastAPI (`api/`)**: Serves the user interface and exposes endpoints to submit provisioning requests, get job status, and stream updates in real-time via Server-Sent Events (SSE).
2. **RQ Worker (`worker/`)**: Runs background processes pulled from the Redis queue. Executes sequential automation pipelines (Preflight health check before every pipeline -> Active Directory user creation -> PaperCut synchronization -> Microsoft 365 license assignment with user existence pre-check and retry -> Email notification).
3. **Frontend (`frontend/`)**: React web app dashboard to monitor active/queued jobs, inspect progress logs, and trigger manual steps if needed.
4. **Mock Scripts (`temp/`)**: Quick helper tools to test logic safely in offline/dry-run mode or verify connection issues with active components (LDAP, PaperCut RPC API).
