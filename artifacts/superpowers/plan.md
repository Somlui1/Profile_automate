# Implementation Plan: Production-Ready Docker Compose and Dependency Setup

## Goal
Optimize `docker-compose.yml` and project dependencies (FastAPI, Redis, RQ) to be production-ready under **Option B (Advanced Hardening & Volume Isolation)**, ensuring security, automatic recovery, and eliminating permission conflicts on Linux production hosts.

## Assumptions
- The local Python environment (.venv) represents the stable package baseline:
  - `redis==8.0.0`
  - `rq==2.9.0`
  - `sse-starlette==3.0.3`
  - `rq-dashboard==0.8.7`
  - `fastapi==0.110.0`
  - `uvicorn==0.28.0`
  - `python-multipart==0.0.9`
  - `pypdf==6.6.0`
  - `python-dotenv==1.2.1`
  - `ldap3==2.9.1`
  - `requests==2.32.5`
- The system will be run via `docker compose` in both development (using profiles/local settings) and production environments.
- The Redis connection format `redis://[:password]@host:port/db` is natively supported by `redis.Redis.from_url`.

## Plan

### Step 1: Pin Python Dependencies in Requirements Files
- **Files**:
  - [requirements.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/requirements.txt)
  - [api/requirements.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/api/requirements.txt)
  - [worker/requirements.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/requirements.txt)
- **Change**: Replace loose `>=` dependency definitions with strict `==` pinning to match the stable development versions.
- **Verify**: Inspect the files and ensure all packages are pinned to exact versions.

### Step 2: Implement Security and Volume Changes in Docker Compose
- **Files**:
  - [docker-compose.yml](file:///c:/Users/wajeepradit.p/git/profile_automate/docker-compose.yml)
- **Change**:
  - Remove/comment out the `ports` mapping for the `redis` service (so it's only accessible via internal bridge network in production).
  - Add `command: redis-server --requirepass ${REDIS_PASSWORD:-somestrongpassword}` to `redis`.
  - Add `restart: unless-stopped` to `redis`, `api`, and `worker` services.
  - Define a named Docker volume `sqlite_data` in the top-level `volumes` block.
  - Change `volumes` in `api` and `worker` from host path `./data:/app/data` to named volume `sqlite_data:/app/data`.
  - Pass `REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0` to the environment block of `api` and `worker` to support the Redis password.
- **Verify**: Run `docker compose config` in terminal to verify that the compose file parses correctly.

### Step 3: Update Environment Template files
- **Files**:
  - [.env.example](file:///c:/Users/wajeepradit.p/git/profile_automate/.env.example)
  - `.env` (local file if exists)
- **Change**: Add `REDIS_PASSWORD` as a configurable variable, and update the default `REDIS_URL` string to include the password placeholder.
- **Verify**: Check `.env.example` to ensure it documents the new Redis security configurations.

### Step 4: Harden Dockerfiles with Non-Root Users
- **Files**:
  - [api/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/api/Dockerfile)
  - [worker/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/Dockerfile)
- **Change**:
  - Add a non-root system user (`appuser` with UID `10001`) in both Dockerfiles, change ownership of the `/app` directory, and switch execution to `appuser`.
- **Verify**: Run `docker compose build` to verify the images build correctly under the non-root configuration.

### Step 5: End-to-End Validation
- **Files**: None
- **Change**: Spin up the entire containerized application locally and test a job run.
- **Verify**:
  - Run `docker compose up --build -d` to start all services.
  - Run `docker compose logs api` and `docker compose logs worker` to verify successful connection to Redis and SQLite initialization without permission errors.
  - Run the test sync job script: `python enqueue_job.py` or trigger a sync job from the local browser client and confirm it gets successfully queued, executed, and saved in SQLite.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Named volumes make it harder to access SQLite `jobs.db` from host system during local debug | The `redis-insight` service or a simple debug CLI command can be used. We can also mount the data directory back to the host via dev-specific override file if needed, but named volume is highly recommended for production staging. |
| Redis password contains special characters | Always wrap the `REDIS_PASSWORD` value in quotes inside `.env` to prevent shell parsing errors. |
| Root permissions required by some base container utilities | `appuser` is created as a system user with UID 10001, which has sufficient privileges for python execution and package operations in `/app`, and avoids running code as root. |

---

## Rollback plan
- To revert the changes, run:
  ```bash
  git checkout -- requirements.txt api/requirements.txt worker/requirements.txt docker-compose.yml api/Dockerfile worker/Dockerfile
  ```
- Any newly created docker volumes can be cleaned up using:
  ```bash
  docker compose down -v
  ```

