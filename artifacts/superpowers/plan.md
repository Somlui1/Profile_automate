# Implementation Plan: Keytab authentication for AD connection in worker & api

## Goal
Modify the `api` and `worker` services to authenticate with Active Directory (AD) using a Kerberos keytab file instead of plaintext password in `.env`.

## Kerberos Configuration (from msktutil)

| Parameter | Value |
|---|---|
| Service Account | `svc-admin-it` |
| Kerberos Realm | `AAPICO.COM` |
| KDC / Domain Controller | `ahdomain.aapico.com` |
| SPN | `HTTPS/hub-itcenter.aapico.com` |
| Principal | `svc-admin-it@AAPICO.COM` |
| Keytab Path (Host) | `/opt/keytabs/HTTP.keytab` |
| Keytab Path (Container) | `/etc/security/keytabs/HTTP.keytab` |

## Assumptions
1. Keytab file is already created on Linux production host at `/opt/keytabs/HTTP.keytab`.
2. Kerberos configuration `/etc/krb5.conf` is properly configured on the production host with realm `AAPICO.COM` and KDC `ahdomain.aapico.com`.
3. Dual-mode support: The system supports both `simple` (password) and `kerberos` (keytab) authentication methods, controlled via `AD_AUTH_METHOD` in `.env`.
4. `AD_HOSTS` must use FQDN `ahdomain.aapico.com` (not IP) when using Kerberos mode.

## .env Configuration (new variables)

```dotenv
# --- Kerberos Authentication (Production) ---
AD_AUTH_METHOD=kerberos
AD_HOSTS=ahdomain.aapico.com
KRB5_PRINCIPAL=svc-admin-it@AAPICO.COM
KRB5_KEYTAB=/etc/security/keytabs/HTTP.keytab
```

## Plan

### Step 1: Install OS and Python dependencies for Kerberos
* **Files**: 
  * [api/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/api/Dockerfile)
  * [worker/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/Dockerfile)
  * [api/requirements.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/api/requirements.txt)
  * [worker/requirements.txt](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/requirements.txt)
* **Change**:
  * Install `krb5-user`, `libkrb5-dev`, and `gcc` in both Dockerfiles.
  * Add `gssapi>=1.8.0` to both `requirements.txt` files.
* **Verify**:
  * Build docker images and verify packages compile successfully.

---

### Step 2: Add Configuration Settings for Kerberos authentication
* **Files**:
  * [worker/core/config.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/core/config.py)
  * [.env.example](file:///c:/Users/wajeepradit.p/git/profile_automate/.env.example)
* **Change**:
  * Add new settings in `config.py`:
    * `AD_AUTH_METHOD` — values: `simple` (default) or `kerberos`
    * `KRB5_PRINCIPAL` — e.g. `svc-admin-it@AAPICO.COM`
    * `KRB5_KEYTAB` — e.g. `/etc/security/keytabs/HTTP.keytab`
  * Add `WORKER_AD_AUTH_METHOD`, `WORKER_KRB5_PRINCIPAL`, `WORKER_KRB5_KEYTAB` (with fallback to non-prefixed versions, matching existing pattern).
  * Update `.env.example` with the new variables and comments.
* **Verify**:
  * `.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0,'worker'); from core.config import settings; print(settings.AD_AUTH_METHOD)"`

> [!NOTE]
> `api` shares the same `config.py` pattern. The `api/core/config.py` will also need the same variables added.

---

### Step 3: Modify connection logic in ad_service to support SASL GSSAPI
* **Files**:
  * [api/services/ad_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/api/services/ad_service.py)
  * [worker/services/ad_service.py](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/services/ad_service.py)
* **Change**:
  * Update `__init__` to read `AD_AUTH_METHOD` and store it.
  * Update `mock_mode` check: when `AD_AUTH_METHOD == "kerberos"`, do not require `AD_USER`/`AD_PASSWORD`.
  * Modify `_get_connection()`:
    * If `kerberos`: set `KRB5_CLIENT_KTNAME` env var, use `authentication=SASL`, `sasl_mechanism=KERBEROS` (no user/password).
    * If `simple`: keep current behavior (user/password bind).
* **Verify**:
  * `.\.venv\Scripts\python.exe -m py_compile api\services\ad_service.py`
  * `.\.venv\Scripts\python.exe -m py_compile worker\services\ad_service.py`

---

### Step 4: Create Entrypoint scripts to perform kinit
* **Files**:
  * `[NEW]` [api/entrypoint.sh](file:///c:/Users/wajeepradit.p/git/profile_automate/api/entrypoint.sh)
  * `[NEW]` [worker/entrypoint.sh](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/entrypoint.sh)
  * [api/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/api/Dockerfile)
  * [worker/Dockerfile](file:///c:/Users/wajeepradit.p/git/profile_automate/worker/Dockerfile)
* **Change**:
  * Create `entrypoint.sh` that:
    1. Checks if `AD_AUTH_METHOD == kerberos`
    2. Runs `kinit -kt "$KRB5_KEYTAB" "$KRB5_PRINCIPAL"` to obtain TGT
    3. Runs `klist` to log the ticket info
    4. Executes the original CMD (`exec "$@"`)
  * Update Dockerfiles to `COPY entrypoint.sh`, `RUN chmod +x`, and set as `ENTRYPOINT`.
* **Verify**:
  * Confirm entrypoint scripts use UNIX style (LF) line endings.

---

### Step 5: Update docker-compose.yml to mount keytab and krb5.conf
* **Files**:
  * [docker-compose.yml](file:///c:/Users/wajeepradit.p/git/profile_automate/docker-compose.yml)
* **Change**:
  * Mount `/opt/keytabs/HTTP.keytab` → `/etc/security/keytabs/HTTP.keytab:ro` for both `api` and `worker`.
  * Mount `/etc/krb5.conf` → `/etc/krb5.conf:ro` for both `api` and `worker`.
  * Add environment variables `AD_AUTH_METHOD`, `KRB5_PRINCIPAL`, `KRB5_KEYTAB` (read from `.env`).
* **Verify**:
  * `docker compose config` to validate YAML syntax.

---

## Risks & mitigations
* **Risk: Permissions issue on mounted Keytab file.**
  * *Mitigation*: Ensure keytab file on host has read permissions (`chmod 644` or at minimum readable by Docker user).
* **Risk: Ticket expiration during long-running processes.**
  * *Mitigation*: Add a periodic `kinit` renewal (cron or background loop) inside entrypoint, or rely on GSSAPI auto-renewal.
* **Risk: DNS resolution failure for FQDN inside container.**
  * *Mitigation*: Ensure Docker network DNS can resolve `ahdomain.aapico.com`. Use `dns` option in docker-compose if needed.
* **Risk: Time skew between container and AD (>5 min causes KRB5KRB_AP_ERR_SKEW).**
  * *Mitigation*: Docker inherits host clock by default. Ensure host NTP is synced.

## Rollback plan
1. Switch `AD_AUTH_METHOD=simple` in `.env` on production — immediate fallback to password auth.
2. Revert code changes in git if needed.
