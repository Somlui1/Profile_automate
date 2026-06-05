# IT Resource Provisioning System (3-Tier)

An automated system to provision Active Directory user accounts and sync printer configurations on Papercut, utilizing an IT Resource Request PDF form parsed dynamically from a Web Admin Dashboard.

---

## System Architecture

```text
                  ┌──────────────────────────────┐
                  │      Web Admin Frontend      │
                  │      (HTML, CSS, JS UI)      │
                  └──────────────┬───────────────┘
                                 │
                           HTTP REST API
                            (JSON Payload)
                                 │
                  ┌──────────────▼───────────────┐
                  │      FastAPI Backend API     │
                  │     (Python Application)     │
                  └────────┬──────────────┬──────┘
                           │              │
                      LDAP / LDAPS     XML-RPC
                           │              │
             ┌─────────────▼─────┐  ┌─────▼─────────────┐
             │  Active Directory │  │   Papercut API    │
             │(Domain Controller)│  │ (Printer System)  │
             └───────────────────┘  └───────────────────┘
```

---

## User Provisioning Workflow

When an administrator clicks **Create User** (or submits a Sync request) via the Web Dashboard, the system runs through the following sequence:

1. **Information Collection**: The UI collects user details (Thai & English names, employee ID, position, department, address, etc.), targeting the designated OU (New Hire or Contractor).
2. **REST API Request**: The frontend makes a POST request to `/api/v1/user/sync` containing the JSON payload.
3. **Username & PIN Generation**:
   - The backend automatically generates a `sAMAccountName` (e.g. `first_name.last_initial`) if none is provided.
   - The printer PIN defaults to the user's `employee_id` if not custom-defined.
4. **Active Directory Check & Creation**:
   - Queries Active Directory via LDAP to check if the user already exists.
   - If the user is new, it provisions the account in the selected OU as **initially disabled** (`userAccountControl` = "514") and forces a password reset on first login (`pwdLastSet` = 0).
   - If the user already exists, it skips creation.
5. **Papercut Print System Sync**:
   - Commands Papercut to synchronize and pull the new AD user.
   - Sets the user's card PIN/print code in Papercut for secure print authorization.
6. **API Response & UI Update**: Returns status results to the web UI, updating the progress checklist in real-time.

---

## Directory Structure

```text
├── api/                      # FastAPI Application (Producer & REST APIs)
│   ├── core/                 # Configs, SQLite Database, Redis Connections
│   ├── endpoints/            # REST API Routes (Jobs, Debug, Parsing)
│   ├── services/             # Business Logic (LDAP, XML-RPC, M365)
│   └── main.py               # API Entry Point
│
├── worker/                   # RQ Worker Process (Consumer)
│   ├── tasks/                # Flexible Provisioning Pipeline (sync_user.py)
│   └── run.py                # Worker Entry Point
│
├── frontend/                 # Interactive Admin Dashboard
│   ├── index.html            # Web UI with Debug Panel
│   ├── css/                  # Stylesheets
│   └── js/                   # App Logic & SSE Real-time Updates
│
├── data/                     # Persistent Volumes (SQLite jobs.db)
├── docs/                     # Documentation & References
├── .env                      # Unified environment configurations
├── docker-compose.yml        # Multi-container orchestration
└── README.md                 # Project root instructions
```

---

## Getting Started (Docker - Recommended)

The easiest way to run the entire system (API, Redis, Worker) is via Docker Compose.

### 1. Configuration
Create or edit your `.env` file at the root. The `REDIS_URL` should point to `redis://redis:6379/0` if using Docker.

```env
# Active Directory Configuration
AD_HOSTS=10.10.10.250
AD_USER=your-ad-username
AD_PASSWORD=your-ad-password
AD_BASE_DN=DC=aapico,DC=com

# Papercut API Configuration
PAPERCUT_API_URL=http://your-papercut-server:9191/rpc/api/xmlrpc
PAPERCUT_API_KEY=your-papercut-auth-token

# Infrastructure (Docker Defaults)
REDIS_URL=redis://redis:6379/0
DB_PATH=/app/data/jobs.db
DEBUG_MODE=true
```

### 2. Start Services
```bash
# Build and start all services in detached mode
docker compose up -d --build

# View logs for all services
docker compose logs -f

# View logs specifically for the worker
docker compose logs -f worker
```

### 3. Access the System
Open your browser to:
- **Admin UI**: [http://localhost:8000/](http://localhost:8000/)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

*(Optional)* If you want to use the visual Redis GUI (RedisInsight), start with the debug profile:
```bash
docker compose --profile debug up -d
```
Then navigate to [http://localhost:5540/](http://localhost:5540/).

### 4. Stopping
```bash
docker compose down
```
