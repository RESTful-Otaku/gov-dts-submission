# Authentication and RBAC

## Local auth

- Session auth uses server-managed HttpOnly cookies (`dts_session`).
- Local endpoints:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

## Roles

- `viewer`: read-only task access.
- `editor`: full task create/update/delete.
- `admin`: editor permissions plus user management.

Admin-only user APIs:

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

## Seeded QA users

When seeding is enabled, deterministic demo users are created:

- `admin@example.gov` / `AdminPass123!` (admin)
- `editor@example.gov` / `EditorPass123!` (editor)
- `viewer@example.gov` / `ViewerPass123!` (viewer)

## OAuth providers

Supported providers: GitHub, Google, Apple.

Routes:

- `GET /api/auth/oauth/:provider/start`
- `GET /api/auth/oauth/:provider/callback`

Callback behavior:

- Validates state (`dts_oauth_state` cookie).
- Exchanges auth code for token.
- Fetches provider profile.
- Upserts local user by email and creates a local session.
- Redirects to frontend with `?oauth=oauth_success` (or a deterministic error code).

Key env vars:

- `OAUTH_FRONTEND_REDIRECT_URL`
- GitHub: `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`, `OAUTH_GITHUB_REDIRECT_URL`
- Google: `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GOOGLE_REDIRECT_URL`
- Apple: `OAUTH_APPLE_CLIENT_ID`, `OAUTH_APPLE_CLIENT_SECRET`, `OAUTH_APPLE_REDIRECT_URL`, `OAUTH_APPLE_AUTH_URL`, `OAUTH_APPLE_TOKEN_URL`, `OAUTH_APPLE_USERINFO_URL`

Optional overrides for integration testing:

- `OAUTH_GITHUB_AUTH_URL`, `OAUTH_GITHUB_TOKEN_URL`, `OAUTH_GITHUB_USERINFO_URL`
- `OAUTH_GOOGLE_AUTH_URL`, `OAUTH_GOOGLE_TOKEN_URL`, `OAUTH_GOOGLE_USERINFO_URL`
