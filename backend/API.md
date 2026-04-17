# Task API

Base URL: `http://localhost:8080`

## Health and probes

- **GET** `/api/health` — returns `200` and `{ "status": "ok" }`.
- **GET** `/api/live` — liveness probe; returns `200` if the process is running (no DB check).
- **GET** `/api/ready` — readiness probe; returns `200` and `{ "status": "ready" }` if the database is reachable, otherwise `503` and `{ "error": "..." }`.

## Tasks

- **Auth:** Task endpoints require `Authorization: Bearer <token>` when auth is enabled (default for non-development environments).
- **POST** `/api/tasks` — create task. Body: `{ "title", "description?", "status", "priority?", "owner?", "tags?", "dueAt" }` (RFC3339). Status: `todo` | `in_progress` | `done`. Priority: `low` | `normal` | `high` | `urgent`. Validation: title required, dueAt in future.
- **GET** `/api/tasks` — list tasks (ordered by due date) with pagination:
  - `limit` (optional, default `50`, max `200`)
  - `offset` (optional, default `0`)
- **GET** `/api/tasks/{id}` — get one task.
- **PATCH** `/api/tasks/{id}` — update status only. Body: `{ "status" }`.
- **PUT** `/api/tasks/{id}` — update task. Body: `{ "title?", "description?", "status?", "priority?", "tags?" }`.
- **DELETE** `/api/tasks/{id}` — delete task.

Errors return `{ "error": "message" }` with appropriate status codes (400, 401, 404, 413, 415, 500, 503).

## Request rules (mutations)

- **Content-Type:** `POST`, `PATCH`, and `PUT` must use `Content-Type: application/json` (a `charset` parameter is fine, e.g. `application/json; charset=utf-8`).
- **Body size:** JSON body must not exceed **1 MiB**.
- **JSON:** Unknown top-level fields are rejected (`400`). A single JSON object only (no trailing extra values).

## CORS (browser clients)

- Default development/mobile origins are allowed when **`CORS_ALLOWED_ORIGINS`** is unset.
- Set **`CORS_ALLOWED_ORIGINS`** in production to a comma-separated list of exact `Origin` values (e.g. `https://app.example.com`).
- The `null` origin is denied by default. Enable only when required via **`CORS_ALLOW_NULL_ORIGIN=true`**.

## Security and startup flags

- **`API_AUTH_REQUIRED`** — explicit auth toggle (`true`/`false`). If unset, auth defaults to enabled outside development.
- **`API_AUTH_TOKEN`** — bearer token used for task endpoints when auth is enabled.
- **`SEED_DEMO_TASKS`** — if set, overrides demo-data seeding behavior (`true`/`false`). Default seeds only in `APP_ENV=development`.
- **`ALLOW_DESTRUCTIVE_MIGRATIONS`** — must be set to `true` to allow dropping legacy integer-ID task tables during migration.

