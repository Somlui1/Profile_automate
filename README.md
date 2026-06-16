# IT Resource Provisioning System (3-Tier)

An automated enterprise resource provisioning engine designed to parse request PDFs, create Active Directory (AD) user accounts, synchronise print configurations on PaperCut, and assign Microsoft 365 licenses.

---

## 🏗️ System Architecture

The system utilizes a modern 3-Tier architecture comprising a Vite React frontend dashboard, a Python FastAPI gateway, and an asynchronous Redis Queue (RQ) background worker.

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend [React Admin Dashboard]
        Vite[Vite React App]
        Tailwind[Tailwind CSS v4]
        Motion[Motion Animations]
        Lucide[Lucide Icons]
    end

    %% Backend Layer
    subgraph Backend [FastAPI Application Server]
        FastAPI[FastAPI Router]
        PDFService[PDF Parser Service - pypdf]
        ADService[AD LDAP Service - ldap3]
        Papercut[Papercut Service - xmlrpc]
        M365[M365 Service - Graph API]
        EmailService[Email Service - smtplib]
        SSE[SSE Starlette - Real-time Events]
        DB[(SQLite jobs.db)]
    end

    %% Queue Layer
    subgraph Queue [Redis Broker]
        Redis[(Redis Broker)]
        RQ[RQ Queue Manager]
    end

    %% Worker Layer
    subgraph Worker [RQ Worker Process]
        RQWorker[RQ Worker Instance]
        Pipeline[Sync User Job Pipeline]
    end

    %% External Directory Services
    subgraph External [Target External Infrastructure]
        AD[(Active Directory / LDAP)]
        PC[Papercut Printer server]
        MSGraph[Microsoft Graph API]
        SMTPServer[(SMTP Server - No Auth)]
    end

    %% Connection routes
    Vite -->|1. Upload PDF / Submit Sync| FastAPI
    Vite -->|2. Get SSE Real-time Logs| SSE
    FastAPI -->|Write Jobs / Retrieve| DB
    FastAPI -->|Enqueue Task| RQ
    RQ -->|Message Broker| Redis
    Redis -->|Pull Task| RQWorker
    RQWorker -->|Run Task| Pipeline
    Pipeline -->|Create User| ADService
    Pipeline -->|Card PIN Sync| Papercut
    Pipeline -->|Check / Apply License| M365
    Pipeline -->|Send Welcome Email| EmailService
    Pipeline -->|Update Log Event| Redis
    Redis -->|Push Log via Uvicorn| SSE
    ADService -->|LDAPs Port 636| AD
    Papercut -->|XML-RPC Port 9191| PC
    M365 -->|OAuth2 HTTPS| MSGraph
    EmailService -->|SMTP Port 25 - No Auth| SMTPServer
```

---

## 🛠️ Technology Stack & Libraries

### 1. Frontend Client
* **Framework**: React 19 (Single-page application)
* **Build Tool & Server**: Vite 6 (Fast local compiling and proxy routing)
* **Language**: TypeScript (Type-safe component design)
* **Styling**: Tailwind CSS v4 (Utility-first styling with modern CSS configuration)
* **Animations**: Motion (Clean transitions and micro-animations)
* **Icons**: Lucide React (Consistent visual UI indicators)

### 2. Backend REST API
* **Language**: Python 3.11+
* **Framework**: FastAPI (High-performance web API framework)
* **Web Server**: Uvicorn (Asynchronous ASGI server)
* **Real-time Engine**: sse-starlette (Server-Sent Events streaming server-side logs)
* **Database**: SQLite3 (Persistent tracking of provisioning jobs and logs)
* **Configuration**: python-dotenv (Environment configuration injector)

### 3. Service Integrations (Backend)
* **Active Directory Sync**: `ldap3` (Python LDAP client supporting LDAPS, failover configurations, and SSL)
* **PaperCut Integration**: `xmlrpc.client` (Built-in XML-RPC protocol for user property synchronization)
* **M365 License Provisioning**: `requests` (OAuth2 Client Credentials flow and Microsoft Graph API queries)
* **Email Notification**: `smtplib` / `email` (Built-in SMTP client sending notifications via unauthenticated SMTP relay)
* **PDF Extraction**: `pypdf` (Robust layout parsing of IT Resource request forms)

### 4. Background Job Queue
* **Broker**: Redis (High-speed message cache store)
* **Task Engine**: `rq` (Redis Queue for asynchronous job orchestration and worker execution)

---

## 🔄 User Provisioning Sequence Workflow

The sequential steps from parsing an administrative request PDF form to executing background synchronizations are detailed below.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as System Administrator
    participant UI as Vite React Admin UI
    participant API as FastAPI Backend Server
    participant DB as SQLite database
    participant Redis as Redis Queue (RQ)
    participant Worker as Python RQ Worker
    participant AD as Active Directory (LDAPs)
    participant PC as Papercut server (XML-RPC)
    participant MS as Microsoft Graph (OAuth2)
    participant Mail as SMTP Relay Server (No Auth)

    Note over Admin, UI: Phase 1: PDF Request Parsing & Verification
    Admin->>UI: Upload Resource Request PDF
    UI->>API: POST /api/v1/parse/ (multipart/form-data)
    Note over API: pdf_service parses PDF using pypdf<br/>Extracts Thai/EN names, Position, Dept, etc.
    API-->>UI: Return extracted JSON payload
    UI->>UI: Pre-populate step inputs with JSON data
    Admin->>UI: Click "Verify" to validate inputs
    UI->>API: POST /api/v1/user/ad/check-user (payload)
    API->>AD: LDAP Search for existing sAMAccountName / Name
    AD-->>API: LDAP search entries (Exists/Not Exists)
    API-->>UI: Return AD Verification Status (e.g. Exists = False)

    Note over Admin, UI: Phase 2: M365 License Fetching
    UI->>API: GET /api/v1/m365/licenses
    API->>MS: OAuth2 token request & GET /subscribedSkus
    MS-->>API: Subscribed Skus JSON payload
    API-->>UI: Return available M365 Friendly mapped list

    Note over Admin, UI: Phase 3: Job Submission & Queueing
    Admin->>UI: Select OU Placement & M365 Licenses, then click "Submit Sync"
    UI->>API: POST /api/v1/user/sync (Sync Payload)
    Note over API: Initialize Job Record in SQLite DB
    API->>DB: INSERT INTO jobs (status='queued', current_step='ad_creation')
    API->>Redis: Enqueue 'sync_user' task (job_id, payload)
    API-->>UI: Return queued Job ID response
    UI->>UI: Redirect to Job Queue / Start listening to SSE Logs

    Note over UI, API: Phase 4: Real-time Event Streaming
    UI->>API: GET /api/v1/jobs/stream/{job_id} (EventSource)
    API-->>UI: HTTP 200 Stream Event Connection established

    Note over Redis, Worker: Phase 5: Asynchronous Worker Pipeline Execution
    Worker->>Redis: Dequeue task 'sync_user' (job_id)
    Worker->>DB: UPDATE job status = 'processing'
    Worker->>API: SSE Log: "Pipeline initiated in processing mode"
    API-->>UI: SSE Push Message: "Pipeline initiated..."

    Note over Worker, AD: Step 5.1: Active Directory Provisioning
    Worker->>AD: Connect & Bind using Admin DN/Password
    Worker->>AD: Create User Object (Disabled, UPN, sAMAccountName)
    AD-->>Worker: Success / Fail
    Worker->>DB: UPDATE job current_step = 'papercut_sync'
    Worker->>API: SSE Log: "LDAP Object successfully established"
    API-->>UI: SSE Push Message

    Note over Worker, PC: Step 5.2: Papercut Synchronize & PIN Setup
    Worker->>PC: performUserAndGroupSync (Trigger AD refresh)
    PC-->>Worker: Sync trigger accepted
    Worker->>PC: setUserProperty (username, 'card-number', printCode)
    PC-->>Worker: Success / Fail
    Worker->>DB: UPDATE job current_step = 'm365_license'
    Worker->>API: SSE Log: "Papercut sync complete. PIN activated."
    API-->>UI: SSE Push Message

    Note over Worker, MS: Step 5.3: Microsoft 365 License Assignment
    Worker->>MS: Get Access Token & POST /users/{id}/assignLicense
    MS-->>Worker: License Assignment response
    Worker->>DB: UPDATE job current_step = 'send_email'
    Worker->>API: SSE Log: "O365 Graph License Assigned."
    API-->>UI: SSE Push Message

    Note over Worker, Mail: Step 5.4: Email Notification Dispatch
    Worker->>Mail: Connect & Send Onboarding Email (No Auth)
    Mail-->>Worker: SMTP delivery acceptance response
    Worker->>DB: UPDATE job status = 'success', current_step = 'done'
    Worker->>API: SSE Log: "Welcome onboarding email dispatched. Pipeline finished."
    API-->>UI: SSE Push Message
    
    Note over UI: UI Displays Job Complete with Green Progress Checkmarks
```

---

## 🔌 External Connection & Protocol Specifications

Detailed protocols, standard port configuration, authentication flows, and software libraries utilized for external integrations:

| Target Infrastructure | Protocol / Interface | Default Port | Authentication / Security Method | Driver / Client Library |
| :--- | :--- | :--- | :--- | :--- |
| **Active Directory** | **LDAPs** (LDAP over TLS) | `636` (TCP) | Simple Bind (Admin DN / credentials) | `ldap3` (Python client) |
| **PaperCut printer server** | **XML-RPC** (over HTTP/S) | `9191` (HTTP) / `9192` (HTTPS) | Auth API Token (HTTP Header authorization) | `xmlrpc.client` (Python stdlib) |
| **Microsoft 365 / Entra ID** | **Microsoft Graph REST API** | `443` (HTTPS) | OAuth 2.0 Client Credentials flow (Client ID & Secret) | `requests` (OAuth/REST flow) |
| **Email Gateway / SMTP** | **SMTP** (Unauthenticated) | `25` (TCP) | No Authentication (Internal IP relay restriction) | `smtplib` / `email` (Python stdlib) |

---

## 📂 Project Directory Structure

```text
├── api/                      # FastAPI Backend Gateway
│   ├── core/                 # Configs, SQLite database initializer, exceptions
│   ├── endpoints/            # REST API routers (Jobs, User, M365, Parser)
│   ├── services/             # Business log adapters (AD LDAP, PaperCut, M365 Graph, PDF)
│   └── main.py               # Application startup script and static files mount
│
├── worker/                   # Background Task Engine
│   ├── tasks/                # Sync task pipelines (sync_user.py)
│   └── run.py                # RQ Worker boot daemon
│
├── frontend/                 # React Client Panel
│   ├── dist/                 # Production compiled bundles (Vite build output)
│   ├── src/                  # React Source Code
│   │   ├── components/       # UI panels (PDFProvision, JobQueue, ADExplorer, Dashboard)
│   │   ├── App.tsx           # App Router Layout
│   │   ├── main.tsx          # Client bundle initiator
│   │   └── types.ts          # Shared TypeScript type interfaces
│   ├── index.html            # Web Layout template
│   └── package.json          # Vite scripts and frontend dependencies
│
├── data/                     # SQLite database storage directory (jobs.db)
├── .env                      # Universal system configuration environment parameters
├── docker-compose.yml        # Multi-container microservices compose definition
└── README.md                 # System overview documentation
```

---

## 🚀 Getting Started

Ensure Docker and Docker Compose are installed on your target deployment environment.

### 1. Environment Configurations
Create a `.env` file at the root of the workspace matching the required settings:
```env
# Active Directory / LDAP Server
AD_HOSTS=10.10.10.250
AD_USER=aapico\itsupport
AD_PASSWORD=support
AD_BASE_DN=DC=aapico,DC=com

# PaperCut NG/MF API Settings
PAPERCUT_API_URL=http://10.10.10.235:9191/rpc/api/xmlrpc
PAPERCUT_API_KEY=your-auth-token-key

# SMTP Notification Settings (No Authentication)
SMTP_HOST=smtp.aapico.com
SMTP_PORT=25
SMTP_FROM=itsupport@aapico.com

# Redis Broker (Docker default)
REDIS_URL=redis://redis:6379/0
```

### 2. Startup Commands
Run the compose stack in detached mode:
```bash
# Build and run containers
docker compose up -d --build

# Stream logs of all services
docker compose logs -f
```

### 3. UI and Docs Access URLs
* **Admin dashboard panel**: [http://localhost:8000/](http://localhost:8000/)
* **Swagger API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **RQ Queue Dashboard**: [http://localhost:8000/rq](http://localhost:8000/rq)
