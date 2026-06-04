# Architecture and API Contract Handbook

This handbook is a concise map of the current system architecture, contract boundaries, and review invariants.

## System architecture

- Backend entrypoints:
  - `backend/cmd/api/main.go` (SQL-backed API)
  - `backend/cmd/api-mongo/main.go` (Mongo-backed API)
- Backend layers:
  - Transport: `backend/internal/http/api.go`
  - Domain rules: `backend/internal/task/task.go`
  - Persistence contracts/adapters: `backend/internal/storage/*`
- Frontend entrypoints:
  - Composition shell: `frontend/src/app/TaskAppShell.svelte`
  - App controller/state orchestration: `frontend/src/lib/app/task-app/controller.svelte.ts`
  - API client boundary: `frontend/src/lib/api.ts`

## API contract invariants

- Route surface:
  - Health/probes: `GET /api/health`, `GET /api/live`, `GET /api/ready`
  - Tasks: `GET/POST /api/tasks`, `GET/PATCH/PUT/DELETE /api/tasks/{id}`
- Error shape is JSON object with `error` (human-readable) and `code` (stable machine-readable) fields.
- Mutating JSON endpoints require `Content-Type: application/json`.
- JSON request body size is capped at 1 MiB.
- Unknown JSON fields are rejected.
- Pagination contract:
  - `limit` in `[1, 200]` with default `50`
  - `offset >= 0` with default `0`

## Security and interoperability invariants

- Browser CORS preflight allows task mutation/auth flows:
  - `Access-Control-Allow-Headers` includes `Content-Type`, `Authorization`, `X-API-Audience`, and `X-API-Issuer`.
- API token auth:
  - Enabled by default outside development.
  - Controlled by `API_AUTH_REQUIRED` and auth mode env vars (`token`/`jwt`/`oidc`).
- Security headers are applied consistently on API responses.

## Data correctness invariants

- Status and priority must remain enum-constrained in domain validation.
- Store adapters must not silently swallow malformed persisted tags payloads.
- Read/update behavior for concurrent writes must be explicit and tested.

## Frontend UX invariants

- Sticky chrome and onboarding overlays must keep highlighted controls visible and reachable.
- Help/settings + onboarding spotlight layering must preserve interactivity.
- List, cards, and kanban interactions should remain deterministic under filters/search/view-mode changes.

## Test categories and expected scope

- Backend:
  - Unit/domain tests (`internal/task`)
  - HTTP contract tests (`backend/tests/http`)
  - Store adapter tests (`backend/tests/storage`)
- Frontend:
  - Component/unit tests (`frontend/tests/components`, `frontend/tests/lib`, `frontend/tests/tasks`)
  - App integration tests (`frontend/tests/App.*.test.ts`)
  - E2E smoke and critical interaction paths (`frontend/e2e`)

## Versioning consistency rule

The project version must remain synchronized across:

- `VERSION`
- `frontend/package.json` (`version`)
- `backend/openapi.yaml` (`info.version`)

CI enforces this rule in the web build workflow.
