# Task API

Base URL: `http://localhost:8080`

## Health and probes

- **GET** `/api/health` — returns `200` and `{ "status": "ok" }`.
- **GET** `/api/live` — liveness probe; returns `200` if the process is running (no DB check).
- **GET** `/api/ready` — readiness probe; returns `200` and `{ "status": "ready" }` if the database is reachable, otherwise `503` and `{ "error": "..." }`.

## Tasks

- **POST** `/api/tasks` — create task. Body: `{ "title", "description?", "status", "priority?", "owner?", "tags?", "dueAt" }` (RFC3339). Status: `todo` | `in_progress` | `done`. Priority: `low` | `normal` | `high` | `urgent`. Validation: title required, dueAt in future.
- **GET** `/api/tasks` — list all tasks (ordered by due date).
- **GET** `/api/tasks/{id}` — get one task.
- **PATCH** `/api/tasks/{id}` — update status only. Body: `{ "status" }`.
- **PUT** `/api/tasks/{id}` — update task. Body: `{ "title?", "description?", "status?", "priority?", "tags?" }`.
- **DELETE** `/api/tasks/{id}` — delete task.

Errors return `{ "error": "message" }` with appropriate status codes (400, 404, 500).

