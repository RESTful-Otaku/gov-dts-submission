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
| **Overly permissive CORS** | Default CORS allows local dev and mobile origins (`localhost`, `127.0.0.1`, Capacitor, `10.0.2.2`) in development. Outside development, CORS now fails closed unless `CORS_ALLOWED_ORIGINS` is set. The `null` origin is denied unless `CORS_ALLOW_NULL_ORIGIN=true`. |
| **Large or malicious JSON bodies** | POST/PATCH/PUT bodies are limited to **1 MiB**, require `Content-Type: application/json` (charset suffix allowed), reject unknown JSON fields, and reject multiple JSON values per request. |
| **Missing browser hardening headers** | API responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store`. The static SPA image uses the same baseline headers via nginx; Vite dev server sets the same headers for the HTML shell. |
| **Missing TLS** | TLS is expected to be terminated at a reverse proxy or load balancer (e.g. in AWS/Azure). The app listens on HTTP. |
| **Unvalidated input** | All task creation and status updates are validated (title, status enum, due date). Invalid IDs return 400. |
| **Inconsistent client error handling** | Error responses now include a stable machine-readable `code` plus human-readable `error`, enabling deterministic client behavior and reliable telemetry grouping. |

## Data handling

- Task data is stored in the configured database only. No third-party analytics or tracking is included.
- Timestamps are stored in UTC. No PII beyond task title/description is modelled; if extended, classification and retention should be documented.

## Operational security

- **Health checks:** `/api/live` (liveness) and `/api/ready` (readiness, including DB connectivity) support orchestration and failover.
- **Configuration:** No secrets in code or in image; use environment variables or a secrets manager.
- **Dependencies:** Keep Go and frontend dependencies up to date; CI runs dependency and vulnerability checks in `.github/workflows/security-checks.yml`.
- **SAST:** CodeQL analysis runs in `.github/workflows/codeql-analysis.yml` for Go and JavaScript/TypeScript.
- **Release integrity:** Mobile release workflows publish SHA256 checksum + SBOM files and generate provenance attestations.

## Environment variables (security-relevant)

| Variable | Purpose |
|----------|---------|
| `CORS_ALLOWED_ORIGINS` | Optional. Comma-separated **exact** `Origin` values allowed for CORS. When non-empty, replaces all built-in dev/mobile origin rules. |
| `CORS_ALLOW_NULL_ORIGIN` | Optional. Set to `true` only if you must allow `Origin: null` for constrained runtimes. |
| `API_AUTH_REQUIRED` | Optional explicit auth toggle (`true`/`false`). If unset, auth defaults to enabled outside development. |
| `API_AUTH_MODE` | Optional auth mode. `token` (default) uses opaque bearer tokens; `jwt` validates HS256 JWT bearer tokens; `oidc` validates JWTs using issuer discovery + JWKS. |
| `API_AUTH_TOKEN` | Single bearer token (legacy-compatible) accepted on task endpoints when auth is enabled. |
| `API_AUTH_TOKENS` | Comma-separated bearer token list for rotation (new + previous tokens accepted during cutover). |
| `JWT_HS256_SECRET` | Required in `API_AUTH_MODE=jwt`; used to validate HS256 JWT signatures. |
| `OIDC_ISSUER_URL` | Required in `API_AUTH_MODE=oidc`; OIDC issuer URL used for discovery and JWKS retrieval. |
| `OIDC_AUDIENCE` | Required in `API_AUTH_MODE=oidc` (fallback: `API_AUTH_ALLOWED_AUDIENCE`); expected token audience/client id. |
| `API_AUTH_REQUIRED_SCOPES` | Optional. Comma-separated scopes required for authenticated task endpoints (enforced in `jwt`/`oidc` modes). |
| `API_AUTH_REQUIRED_ROLES` | Optional. Comma-separated roles required for authenticated task endpoints (enforced in `jwt`/`oidc` modes). |
| `API_AUTH_REQUIRED_SCOPE_READ` | Optional route-level read scope for `GET /api/tasks*` in `jwt`/`oidc` modes. |
| `API_AUTH_REQUIRED_SCOPE_WRITE` | Optional route-level write scope for `POST`/`PUT`/`PATCH`/`DELETE /api/tasks*` in `jwt`/`oidc` modes. |
| `API_AUTH_ALLOWED_AUDIENCE` | Optional. If set, requests must include `X-API-Audience` with an exact match. |
| `API_AUTH_ALLOWED_ISSUERS` | Optional. Comma-separated issuer values; requests must include `X-API-Issuer` matching one value. |
| `ALLOW_DESTRUCTIVE_MIGRATIONS` | Must be `true` to allow dropping legacy integer-ID task tables during startup migration. |
| `VITE_MOBILE_DB_SECRET` | Required at **Vite build** time when `VITE_MOBILE_LOCAL_DB` is enabled (SQLCipher). Local scripts default via `gov_dts_export_vite_mobile_local_db_env` in `scripts/lib.sh`; CI uses secret `VITE_MOBILE_DB_SECRET` or a public dev fallback with a workflow notice. |

## Recommendations for production

1. Move from single-token auth to platform identity (e.g. OIDC/JWT) with least-privilege authorisation on all task endpoints.
   - Interim support exists via `API_AUTH_MODE=jwt` (HS256 secret) and `API_AUTH_MODE=oidc` (issuer/JWKS validation).
2. Set **`CORS_ALLOWED_ORIGINS`** to your real front-end origin(s); do not rely on localhost defaults.
3. Ensure TLS everywhere; set security headers (e.g. HSTS, CSP) at the edge.
4. Run the application with a non-root user (Dockerfile already uses a dedicated user).
5. Prefer managed databases (e.g. RDS, Azure Database) with encryption at rest and in transit.

## Production hardening checklist

Use this as the release-readiness checklist before promoting to production:

- [ ] `APP_ENV=production` and `API_AUTH_REQUIRED=true`.
- [ ] `API_AUTH_MODE=oidc` with valid `OIDC_ISSUER_URL` and `OIDC_AUDIENCE`.
- [ ] Least-privilege authz enabled:
  - [ ] `API_AUTH_REQUIRED_SCOPE_READ` is set
  - [ ] `API_AUTH_REQUIRED_SCOPE_WRITE` is set
  - [ ] `API_AUTH_REQUIRED_ROLES` is set (if role model applies)
- [ ] `CORS_ALLOWED_ORIGINS` set to exact app origins (no wildcard/dev fallbacks).
- [ ] TLS termination enforced at edge; HTTP not exposed publicly.
- [ ] Mobile local DB: `VITE_MOBILE_DB_SECRET` set to a strong value for store/production builds (not the public dev default); GitHub secret `VITE_MOBILE_DB_SECRET` for release workflows.
- [ ] CI security gates green:
  - [ ] `.github/workflows/security-checks.yml`
  - [ ] `.github/workflows/codeql-analysis.yml`
- [ ] Release integrity artifacts produced:
  - [ ] checksums
  - [ ] SBOM
  - [ ] provenance attestations
- [ ] Security denied-path tests verified (`401`, `403`, `503`) in staging.
