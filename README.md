# DTS Caseworker Task Manager

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](VERSION)
[![CI](https://github.com/RESTful-Otaku/gov-dts-submission/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RESTful-Otaku/gov-dts-submission/actions/workflows/ci.yml)

A full-stack task management app for caseworkers: create, view, update, and delete tasks via a web UI or mobile app. Backend in Go, frontend in Svelte, with SQLite, PostgreSQL, MariaDB or MongoDB.

| Platforms | Databases |
|-----------|-----------|
| Web · Android · iOS | SQLite · PostgreSQL · MariaDB · MongoDB |

---

## Quick start

### Option 1: Interactive script (recommended)

```bash
./scripts/run.sh
```

Choose **Run** → **SQLite** → **Local** (or **Docker**). Press Enter at prompts for defaults.

### Option 2: Manual (2 terminals)

**Terminal 1 — API:**
```bash
cd backend && go run ./cmd/api
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm install && npm run dev
```

Then open **http://localhost:5173**. API runs at **http://localhost:8080**.

---

## Running with different databases

The **run script** supports all four databases; choose at the menu:

```bash
./scripts/run.sh
# → Run → [SQLite | Postgres | MariaDB | MongoDB] → [Local | Docker]
```

**Local + Postgres/MariaDB/MongoDB:** The script starts the DB in Docker and runs API + frontend on your machine.

---

## Mobile (Android / iOS)

**Prerequisites:** Node.js, Go, Java 17 or 21. For Android: [Android Studio](https://developer.android.com/studio) or use the script to install SDK. For iOS: [Xcode](https://developer.apple.com/xcode/) (macOS only).

**Quick run (Android emulator):**
```bash
./scripts/run-android.sh
```
Builds, tests, installs, and launches the app. Downloads Android SDK and creates an emulator on first run.

**Capacitor (manual):**
```bash
cd frontend
npm run cap:sync
npm run cap:android   # or cap:ios on macOS
```

On device, point `VITE_API_BASE` to your API URL before building (e.g. `http://192.168.1.x:8080`).

---

## Testing

```bash
./scripts/run.sh
# → Test
```

## Web app

| Summary | List | Kanban |
|:-------:|:----:|:------:|
| ![Task summary](media/task_summary.png) | ![Task list](media/task_list.png) | ![Task Kanban](media/task_kanban.png) |

| Create | Edit | Delete | Dark mode |
|:------:|:----:|:------:|:---------:|
| ![Create task](media/task_create.png) | ![Edit task](media/task_edit.png) | ![Delete task](media/task_delete.png) | ![Dark mode](media/dark_mode.png) |

## Demos

**Web app**

![Web app demo](media/web_app_demo.gif)

**Mobile app**

![Mobile app demo](media/mobile_app_demo.gif)


