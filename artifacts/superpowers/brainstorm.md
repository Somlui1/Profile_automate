# Brainstorm: Use Keytab instead of Password for AD connection in worker & api

## Goal
Modify the \pi\ and \worker\ services to authenticate with Active Directory (AD) using a Kerberos keytab file (\/opt/keytabs/HTTP.keytab\ located on the Linux production host \qaubuntu01\) instead of the plaintext password configured in \.env\.

## Constraints
1. **Containerized Environment**: Both \pi\ and \worker\ run in Docker containers based on \python:3.11-slim\.
2. **Access to Host Keytab**: The keytab file \/opt/keytabs/HTTP.keytab\ resides on the host and must be made securely available inside the Docker containers.
3. **No Password Fallback on Prod**: Production must use Kerberos authentication exclusively (or prioritize it), while allowing developers to fall back to password or mock authentication for local development.
4. **Kerberos Requirements**: Active Directory domain controllers must be resolved via FQDN (IP addresses cannot be used with Kerberos authentication). Time skew between host/container and KDC must be under 5 minutes.

## Known context
- The keytab path on host: \/opt/keytabs/HTTP.keytab\.
- Both \pi\ and \worker\ use Python \ldap3\ via their respective \d_service.py\ files.
- The \pi\ and \worker\ use Docker Compose (\docker-compose.yml\) and share a \.env\ configuration file.

## Risks
1. **Ticket Expiration**: Kerberos tickets (TGT) expire after a set time (typically 10-24 hours). If not renewed or re-obtained, the LDAP connection will fail.
2. **DNS & FQDN resolution**: Containers must be able to resolve the FQDN of the Domain Controller. If DNS is misconfigured in Docker, Kerberos authentication will fail.
3. **Time Sync**: If the container's system clock drifts from the Active Directory Domain Controller by more than 5 minutes, Kerberos handshakes will fail with \KRB5KRB_AP_ERR_SKEW\.
4. **Permissions on Keytab**: The keytab file mounted inside the container must be readable by the user running the Python process.

## Options (2?4)

### Option 1: Authenticate via \kinit\ in an Entrypoint Wrapper Script (Recommended)
- **Concept**: Add a wrapper shell script as the Docker entrypoint. This script runs \kinit -kt /etc/security/keytabs/HTTP.keytab <PRINCIPAL>\ to obtain a ticket-granting ticket (TGT) before launching the main Python process.
- **Python implementation**: Modify \d_service.py\ to use \SASL\ with mechanism \KERBEROS\ if Kerberos is enabled via environment variables. \ldap3\ will automatically pick up the Kerberos ticket from the default credentials cache.
- **Pros**: 
  - Standard, robust pattern in container environments.
  - Easy debugging (can log in to container and run \klist\).
  - Python code does not need to handle credentials/keytab files directly; it just uses the OS Kerberos ticket cache.
- **Cons**: Requires adding a wrapper script and modifying the \CMD\ or \ENTRYPOINT\ in both Dockerfiles.

### Option 2: Direct Keytab Authentication inside Python using \gssapi\ Client Credentials
- **Concept**: Set the environment variable \KRB5_CLIENT_KTNAME=/etc/security/keytabs/HTTP.keytab\ and pass the principal name to the Python environment or configure GSSAPI initialization.
- **Python implementation**: The \gssapi\ library uses the keytab automatically to establish context during the SASL bind.
- **Pros**:
  - No need for wrapper shell scripts or running \kinit\ in entrypoint.
- **Cons**:
  - Harder to debug Kerberos issues (cannot easily use \klist\).
  - Less standard and more dependent on the specific behavior of the \gssapi\ Python package and underlying GSSAPI library implementation.

## Recommendation
We recommend **Option 1 (Pre-authenticate using \kinit\ in an Entrypoint Wrapper Script)** combined with a flag (\AD_AUTH_METHOD=kerberos\) in the \.env\ configuration.
This ensures:
1. Complete visibility into Kerberos errors on startup.
2. Safe fallbacks for developers who don't have local Kerberos set up.
3. Clear separation of concerns (OS/Docker handles Kerberos ticket management, Python application handles LDAP queries).

## Acceptance criteria
1. **Container Setup**:
   - Both \pi\ and \worker\ Dockerfiles install \krb5-user\, \libkrb5-dev\, and \gcc\.
   - \gssapi\ is added to \
equirements.txt\.
   - \docker-compose.yml\ mounts the keytab directory \/opt/keytabs\ to \/etc/security/keytabs:ro\ and \/etc/krb5.conf\ to \/etc/krb5.conf:ro\.
2. **Environment Configuration**:
   - A new environment variable \AD_AUTH_METHOD\ (values: \simple\, \kerberos\) controls the auth mode.
   - \AD_HOSTS\ contains the FQDNs of the Domain Controllers (e.g. \dc01.aapico.com\), not IPs.
   - \KRB5_PRINCIPAL\ specifies the Kerberos principal to authenticate with.
3. **Application Verification**:
   - If \AD_AUTH_METHOD=kerberos\, the application connects to AD without requiring \AD_PASSWORD\.
   - If \AD_AUTH_METHOD=simple\, the application falls back to standard user/password authentication.
   - The test script or worker starts successfully and can query/write to AD in production using the keytab.
