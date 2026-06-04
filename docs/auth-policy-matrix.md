# Auth Policy Matrix

This document defines practical authentication and authorization profiles for local development, staging, and production.

## Modes

| Mode | Env | Purpose |
|------|-----|---------|
| Opaque token | `API_AUTH_MODE=token` | Simple shared-secret auth, useful for local/dev and transitional deployments |
| JWT HS256 | `API_AUTH_MODE=jwt` | Signed token auth with local HMAC secret, good intermediate hardening |
| OIDC JWKS | `API_AUTH_MODE=oidc` | Platform identity with issuer discovery and key rotation, recommended for production |

## Authorization controls

| Control | Env |
|---------|-----|
| Global required scopes | `API_AUTH_REQUIRED_SCOPES` |
| Global required roles | `API_AUTH_REQUIRED_ROLES` |
| Route-level read scope (`GET /api/tasks*`) | `API_AUTH_REQUIRED_SCOPE_READ` |
| Route-level write scope (`POST/PUT/PATCH/DELETE /api/tasks*`) | `API_AUTH_REQUIRED_SCOPE_WRITE` |

## Recommended environment profiles

## Development profile

Use when iterating locally and debugging auth integrations.

```env
APP_ENV=development
API_AUTH_REQUIRED=true
API_AUTH_MODE=token
API_AUTH_TOKENS=dev-local-token-please-change

# Optional claim-based policy simulation
API_AUTH_REQUIRED_SCOPE_READ=
API_AUTH_REQUIRED_SCOPE_WRITE=
API_AUTH_REQUIRED_SCOPES=
API_AUTH_REQUIRED_ROLES=
```

Notes:
- Prefer enabling auth even in development to catch integration regressions early.
- If you temporarily disable auth (`API_AUTH_REQUIRED=false`), do not carry that into shared environments.

## Staging profile

Use when validating pre-production security behavior and integrations.

```env
APP_ENV=staging
API_AUTH_REQUIRED=true
API_AUTH_MODE=oidc
OIDC_ISSUER_URL=https://your-staging-issuer.example.com
OIDC_AUDIENCE=task-api
API_AUTH_ALLOWED_ISSUERS=https://your-staging-issuer.example.com

# Least privilege defaults
API_AUTH_REQUIRED_SCOPE_READ=tasks:read
API_AUTH_REQUIRED_SCOPE_WRITE=tasks:write
API_AUTH_REQUIRED_ROLES=caseworker
```

Notes:
- Keep staging issuer/audience aligned with actual identity provider configuration.
- Verify both happy path and denied path (`403 insufficient token permissions`) during release testing.

## Production profile (recommended baseline)

Use for live deployments.

```env
APP_ENV=production
API_AUTH_REQUIRED=true
API_AUTH_MODE=oidc
OIDC_ISSUER_URL=https://your-issuer.example.com
OIDC_AUDIENCE=task-api
API_AUTH_ALLOWED_ISSUERS=https://your-issuer.example.com

# Route-level least privilege
API_AUTH_REQUIRED_SCOPE_READ=tasks:read
API_AUTH_REQUIRED_SCOPE_WRITE=tasks:write
API_AUTH_REQUIRED_ROLES=caseworker

# Network boundary hardening
CORS_ALLOWED_ORIGINS=https://app.example.com
```

Notes:
- Prefer OIDC mode for key rotation and managed identity lifecycle.
- Keep CORS explicit and fail closed.
- Treat any auth misconfiguration (`503`) as a release blocker.

## Rollout and migration guidance

1. Start with `token` mode only for local/dev or emergency fallback.
2. Move to `jwt` mode if OIDC is not yet available, with strict audience/issuer checks.
3. Promote to `oidc` mode in staging, validate scope/role policies, then roll into production.
4. Enable route-level scopes before tightening global scopes/roles to avoid broad accidental lockouts.

## Operational checks

- Validate auth mode and required env vars on deployment startup.
- Monitor logs for:
  - missing token (`401`)
  - invalid token (`401`)
  - insufficient permissions (`403`)
  - auth misconfiguration (`503`)
- Include auth denied-path tests in regression and smoke suites.
