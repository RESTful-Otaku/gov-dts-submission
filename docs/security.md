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
| **Weak or default credentials** | Task endpoints can enforce bearer-token authentication. Auth is enabled by default outside development; configure `API_AUTH_TOKEN` via a secret manager. Defaults in docker-compose are for local use only. |
| **Overly permissive CORS** | Default CORS allows local dev and mobile origins (`localhost`, `127.0.0.1`, Capacitor, `10.0.2.2`). **Production:** set `CORS_ALLOWED_ORIGINS` to a comma-separated list of exact browser origins (e.g. `https://app.example.com`); when set, the dev defaults are **not** used. The `null` origin is denied unless `CORS_ALLOW_NULL_ORIGIN=true`. |
| **Large or malicious JSON bodies** | POST/PATCH/PUT bodies are limited to **1 MiB**, require `Content-Type: application/json` (charset suffix allowed), reject unknown JSON fields, and reject multiple JSON values per request. |
| **Missing browser hardening headers** | API responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store`. The static SPA image uses the same baseline headers via nginx; Vite dev server sets the same headers for the HTML shell. |
| **Missing TLS** | TLS is expected to be terminated at a reverse proxy or load balancer (e.g. in AWS/Azure). The app listens on HTTP. |
| **Unvalidated input** | All task creation and status updates are validated (title, status enum, due date). Invalid IDs return 400. |

## Data handling

- Task data is stored in the configured database only. No third-party analytics or tracking is included.
- Timestamps are stored in UTC. No PII beyond task title/description is modelled; if extended, classification and retention should be documented.

## Operational security

- **Health checks:** `/api/live` (liveness) and `/api/ready` (readiness, including DB connectivity) support orchestration and failover.
- **Configuration:** No secrets in code or in image; use environment variables or a secrets manager.
- **Dependencies:** Keep Go and frontend dependencies up to date; run `go mod tidy` and `bun audit` (or your registry’s advisory tooling) on the frontend lockfile as part of CI.

## Environment variables (security-relevant)

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOWED_ORIGINS` | Optional. Comma-separated **exact** `Origin` values allowed for CORS. When non-empty, replaces all built-in dev/mobile origin rules. |
| `CORS_ALLOW_NULL_ORIGIN` | Optional. Set to `true` only if you must allow `Origin: null` for constrained runtimes. |
| `API_AUTH_REQUIRED` | Optional explicit auth toggle (`true`/`false`). If unset, auth defaults to enabled outside development. |
| `API_AUTH_TOKEN` | Bearer token expected on task endpoints when auth is enabled. |
| `ALLOW_DESTRUCTIVE_MIGRATIONS` | Must be `true` to allow dropping legacy integer-ID task tables during startup migration. |

## Recommendations for production

1. Move from single-token auth to platform identity (e.g. OIDC/JWT) with least-privilege authorisation on all task endpoints.
2. Set **`CORS_ALLOWED_ORIGINS`** to your real front-end origin(s); do not rely on localhost defaults.
3. Ensure TLS everywhere; set security headers (e.g. HSTS, CSP) at the edge.
4. Run the application with a non-root user (Dockerfile already uses a dedicated user).
5. Prefer managed databases (e.g. RDS, Azure Database) with encryption at rest and in transit.
