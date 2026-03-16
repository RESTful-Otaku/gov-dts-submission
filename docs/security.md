# Security and risk overview

This document summarises the threat and risk considerations for the Caseworker Task Manager application, and the controls in place. It is intended to support assurance and governance discussions rather than replace a full security assessment.

## Scope

- **In scope:** Backend API (Go), frontend SPA (Svelte), configuration and deployment model.
- **Out of scope:** Formal penetration testing, cryptographic design of third-party libraries.

## Threat overview

| Threat | Mitigation |
|--------|------------|
| **Injection (SQL, XSS)** | Parameterised queries throughout; no concatenation of user input into SQL. Frontend escapes output; API returns JSON. |
| **Sensitive data in logs** | Application logs do not include request bodies or task content. Errors log type/context only. |
| **Weak or default credentials** | No built-in auth in this sample; DB credentials and secrets are supplied via environment (e.g. AWS Secrets Manager, Azure Key Vault). Defaults in docker-compose are for local use only. |
| **Overly permissive CORS** | CORS allows only a configured origin (e.g. `http://localhost:5173` for dev). Production should set a single allowed front-end origin. |
| **Missing TLS** | TLS is expected to be terminated at a reverse proxy or load balancer (e.g. in AWS/Azure). The app listens on HTTP. |
| **Unvalidated input** | All task creation and status updates are validated (title, status enum, due date). Invalid IDs return 400. |

## Data handling

- Task data is stored in the configured database only. No third-party analytics or tracking is included.
- Timestamps are stored in UTC. No PII beyond task title/description is modelled; if extended, classification and retention should be documented.

## Operational security

- **Health checks:** `/api/live` (liveness) and `/api/ready` (readiness, including DB connectivity) support orchestration and failover.
- **Configuration:** No secrets in code or in image; use environment variables or a secrets manager.
- **Dependencies:** Keep Go and Node dependencies up to date; run `go mod tidy` and `npm audit` as part of CI.

## Recommendations for production

1. Introduce authentication and authorisation (e.g. OIDC/JWT) and enforce on all task endpoints.
2. Restrict CORS to the exact front-end origin(s) and avoid wildcards.
3. Ensure TLS everywhere; set security headers (e.g. HSTS, CSP) at the edge.
4. Run the application with a non-root user (Dockerfile already uses a dedicated user).
5. Prefer managed databases (e.g. RDS, Azure Database) with encryption at rest and in transit.
