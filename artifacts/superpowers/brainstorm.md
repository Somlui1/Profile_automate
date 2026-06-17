# Brainstorm: Production-Ready Docker Compose and Dependency Configurations

## Goal
Optimize `docker-compose.yml` and all project dependencies (FastAPI, Redis, RQ, worker dependencies) to make them fully production-ready, ensuring security, stability, reliability, and ease of deployment.

## Constraints
- Must maintain current application behavior, including SQLite database usage and Active Directory connectivity.
- Must support both Linux (primary production environment) and Windows (local development environment).
- Keep Docker as the main production path while ensuring developers can still spin up local services easily.

## Known context
- **Docker Compose (`docker-compose.yml`)**:
  - Exposes Redis port `6379` directly to the host network, which is insecure for production.
  - Mounts relative host paths like `./data:/app/data` for databases, which causes UID/GID permission conflicts on Linux staging/production servers.
  - Lacks `restart` policies (`restart: unless-stopped`) for ensuring container recovery after failures or system reboots.
  - Contains developer-only tools like `redis-insight` using docker compose profiles, which is good but could be optimized.
- **Python Dependencies (`requirements.txt`, `api/requirements.txt`, `worker/requirements.txt`)**:
  - Contains unpinned dependencies using `>=` operators (e.g. `redis>=5.0.0`, `rq>=1.16.0`, `sse-starlette>=2.0.0`, `rq-dashboard>=0.6.7`).
  - Running `pip freeze` locally reveals exact dependencies installed in the `.venv` development environment (e.g. `redis==8.0.0`, `rq==2.9.0`, `sse-starlette==3.0.3`, `rq-dashboard==0.8.7`).
  - API and Worker build scripts copy distinct `requirements.txt` files, which may drift in versioning if unpinned.
- **Security**:
  - Redis runs without a password, posing a major security risk in production.
  - Docker containers run as the root user by default.

## Risks
- **Dependency Drift:** Unpinned library versions will resolve to newer, untested versions during future Docker builds, leading to runtime failures or API mismatches between API and Worker.
- **Data Loss/Read-Only DB:** SQLite databases mounted via relative host paths (`./data`) can lock up with read-only database errors due to Linux permission mapping mismatches between host and container.
- **Service Outages:** Services crashing in production will not auto-restart, leading to manual recovery and downtime.
- **Security Breaches:** If Redis is exposed to the network or runs without authentication, internal queues can be accessed or corrupted.

## Options (2???4)
### Option A: Standard Production Improvements
- Pin all python dependencies in `api/requirements.txt` and `worker/requirements.txt` to the exact versions currently used (`redis==8.0.0`, `rq==2.9.0`, etc.).
- Add `restart: unless-stopped` to `redis`, `api`, and `worker` services.
- Comment out/remove the Redis port exposing to the host, ensuring Redis is only accessible via the internal bridge network.

### Option B: Advanced Production Hardening & Volume Isolation (Recommended)
- **All steps from Option A.**
- **Secure Redis**: Configure Redis with a password (e.g. `REDIS_PASSWORD` via environment variables/secrets) and update connection strings in `api` and `worker`.
- **Docker Named Volumes**: Use Docker named volumes (e.g. `db_data:/app/data` and `redis_data:/data`) instead of relative host mounts to completely bypass UID/GID permission conflicts on Linux production hosts.
- **Production Server Tuning**: Optimize Uvicorn command arguments (e.g. `--workers` scaling) or run behind a lightweight web server structure.
- **Container Non-Root Users**: Update Dockerfiles to create and run applications under a non-privileged `appuser`.

## Recommendation
Implement **Option B (Advanced Production Hardening & Volume Isolation)**. Because this app connects directly to corporate Active Directory, security (Redis password) and data integrity (Docker named volumes avoiding permission issues) are crucial. This option guarantees high availability, security, and consistent environment behavior across local development and production.

## Acceptance criteria
- [ ] All python libraries in all `requirements.txt` files are strictly pinned to exact versions.
- [ ] `docker-compose.yml` services have `restart: unless-stopped` set for automatic recovery.
- [ ] Redis is secured by a password and no longer exposes its port to the host system.
- [ ] Data persistence uses named Docker volumes to prevent SQLite permission mapping failures on Linux production.
- [ ] Containers build and run successfully using `docker compose up --build`.
- [ ] Jobs can be enqueued, run, and complete successfully under the new configuration.

