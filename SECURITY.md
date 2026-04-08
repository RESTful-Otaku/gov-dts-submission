# Security Policy

## Reporting a vulnerability
- Please do not open public issues for security vulnerabilities.
- Report issues privately to the maintainers with:
  - affected component(s)
  - impact and exploitability
  - reproduction steps or proof of concept
  - suggested mitigation (if known)

Maintainers will acknowledge reports and provide remediation status updates.

## Supported security posture
- Task APIs require authentication outside development by default.
- Task APIs support token rotation (`API_AUTH_TOKENS`) and optional audience/issuer metadata checks.
- Task APIs also support `API_AUTH_MODE=jwt` for HS256 JWT bearer validation (`JWT_HS256_SECRET` required).
- Task APIs support `API_AUTH_MODE=oidc` for issuer discovery + JWKS-backed token verification (`OIDC_ISSUER_URL`, `OIDC_AUDIENCE`).
- Task APIs support optional scope/role authorization gates (`API_AUTH_REQUIRED_SCOPES`, `API_AUTH_REQUIRED_ROLES`) in JWT/OIDC modes.
- Task APIs support optional route-level scopes: `API_AUTH_REQUIRED_SCOPE_READ` for `GET /api/tasks*` and `API_AUTH_REQUIRED_SCOPE_WRITE` for mutating task routes.
- CORS defaults are development-only; production should set exact origins via `CORS_ALLOWED_ORIGINS`.
- Mobile production builds should avoid cleartext transport.

Canonical implementation and environment guidance lives in `docs/security.md` and `docs/auth-policy-matrix.md`.

## Security checks
- CI runs automated dependency and vulnerability checks in `.github/workflows/security-checks.yml`.
- CI runs CodeQL SAST in `.github/workflows/codeql-analysis.yml`.
- Release workflows publish SHA256 checksum files and SBOM files alongside mobile artifacts.
- Release workflows emit build provenance attestations for published mobile artifacts.

## Production readiness
- Use the production hardening checklist in `docs/security.md`.

## Secrets handling
- Do not hardcode credentials in source.
- Use environment variables or secret management systems.
