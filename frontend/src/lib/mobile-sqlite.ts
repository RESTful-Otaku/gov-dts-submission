/**
 * Native Capacitor store: demo users + tasks on device (dev/staging APK/IPA) so the app runs without a remote API.
 * Passwords for seeded rows use {@link DEMO_SEED_DEMO_PASSWORD}; new registrations use Argon2id (same params as the API).
 */
import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import type {
  AuthPayload,
  AuthUser,
  CreateTaskPayload,
  RecoverPasswordPayload,
  RecoverPasswordResponse,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateStatusPayload,
  UpdateTaskPayload,
} from './api'
import { buildDemoTaskTemplates, DEMO_SEED_DEMO_PASSWORD, DEMO_SEED_PASSWORD_HASH, DEMO_SEED_USERS } from './demo-seed-data'
import { hashPasswordArgon2id, verifyPasswordArgon2id } from './local-auth-password'

const DB_NAME = 'taskmanager'
const DB_VERSION = 1
// SQLCipher mode for app-owned encrypted DBs created from scratch.
// "encryption" expects migrating an existing plaintext DB and fails when file does not yet exist.
const ENCRYPTION_MODE = 'secret'
/** Arg 2 of createConnection: use SQLCipher encryption. */
const USE_SQLCIPHER_ENCRYPTION = true
/** Arg 5 of createConnection / isConnection / retrieveConnection: false = read-write. */
const CONNECTION_READONLY = false

let dbPromise: Promise<SQLiteDBConnection> | null = null

function getMobileDbSecret(): string {
  const raw = String(import.meta.env.VITE_MOBILE_DB_SECRET ?? '').trim()
  if (!raw) {
    throw new Error(
      'VITE_MOBILE_DB_SECRET is required when native mobile SQLite is enabled (VITE_MOBILE_LOCAL_DB). ' +
        'Set a strong passphrase at build time, or export env before `bun run build`: ' +
        'see scripts/lib.sh `gov_dts_export_vite_mobile_local_db_env` and GitHub secret VITE_MOBILE_DB_SECRET for releases.',
    )
  }
  return raw
}

async function ensureEncryptionSecret(sqlite: SQLiteConnection): Promise<void> {
  const secret = getMobileDbSecret()
  const sqliteAny = sqlite as unknown as {
    isSecretStored?: () => Promise<{ result?: boolean }>
    setEncryptionSecret?: (input: { passphrase: string } | string) => Promise<void>
    changeEncryptionSecret?: (input: { passphrase: string; oldpassphrase: string }) => Promise<void>
  }

  const stored = await sqliteAny.isSecretStored?.()
  if (stored?.result) {
    return
  }
  if (!sqliteAny.setEncryptionSecret) {
    throw new Error('SQLite encryption secret API is unavailable on this platform build')
  }
  // Plugin API shape differs across platforms/builds:
  // - some expect raw string
  // - others expect { passphrase: string }
  // Try string first to avoid nested passphrase payloads on Android bridge logs.
  try {
    await sqliteAny.setEncryptionSecret(secret)
    return
  } catch {
    await sqliteAny.setEncryptionSecret({ passphrase: secret })
  }
}

const META_SEED_DEMO_V3 = 'seed_local_demo_v3'
const META_SESSION_USER = 'local_session_user_id'

function nowIso(): string {
  return new Date().toISOString()
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    // Last-resort fallback for unusual runtimes without Web Crypto.
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Date.now() + i) & 0xff
  }
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `task-${Date.now()}-${rand}`
}

function normalizePriority(priority?: TaskPriority): TaskPriority {
  return priority ?? 'normal'
}

function normalizeStatus(status?: TaskStatus): TaskStatus {
  return status ?? 'todo'
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function stringifyTags(tags?: string[]): string {
  return JSON.stringify(tags ?? [])
}

function dueIsoFromNow(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(9, 0, 0, 0)
  while (d.getTime() <= Date.now()) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString()
}

function taskRowCount(values: { values?: unknown[] } | undefined): number {
  const row = values?.values?.[0] as Record<string, unknown> | undefined
  if (!row) return 0
  const raw =
    row.count ??
    row.COUNT ??
    row['COUNT(*)'] ??
    Object.values(row).find((v) => v !== undefined && v !== null)
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : 0
}

function rowToAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    username: String(row.username),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    role: row.role as AuthUser['role'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    status: normalizeStatus(row.status as TaskStatus),
    priority: normalizePriority(row.priority as TaskPriority),
    owner: row.owner == null ? '' : String(row.owner),
    tags: parseTags(row.tags as string),
    dueAt: String(row.due_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function ensureLocalDemoSeed(db: SQLiteDBConnection): Promise<void> {
  const done = await db.query(`SELECT value FROM app_meta WHERE key = ?`, [META_SEED_DEMO_V3])
  if ((done.values?.length ?? 0) > 0) {
    return
  }

  const userCountRes = await db.query(`SELECT COUNT(*) AS count FROM users`)
  if (taskRowCount(userCountRes) === 0) {
    const now = nowIso()
    for (const u of DEMO_SEED_USERS) {
      await db.run(
        `INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, u.email, u.username, u.firstName, u.lastName, DEMO_SEED_PASSWORD_HASH, u.role, now, now],
      )
    }
  }

  const titleRows = await db.query(`SELECT title FROM tasks`)
  const titles = new Set(
    (titleRows.values ?? []).map((r) => String((r as Record<string, unknown>).title ?? '')),
  )
  const now = nowIso()
  for (const tmpl of buildDemoTaskTemplates()) {
    if (titles.has(tmpl.title)) continue
    await db.run(
      `INSERT INTO tasks (id, title, description, status, priority, owner, tags, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        tmpl.title,
        tmpl.description,
        tmpl.status,
        tmpl.priority,
        tmpl.owner,
        stringifyTags(tmpl.tags),
        dueIsoFromNow(tmpl.dueDays),
        now,
        now,
      ],
    )
    titles.add(tmpl.title)
  }

  await db.run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [META_SEED_DEMO_V3, nowIso()])
}

async function getDb(): Promise<SQLiteDBConnection> {
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    await ensureEncryptionSecret(sqlite)
    await sqlite.checkConnectionsConsistency()

    const existing = await sqlite.isConnection(DB_NAME, CONNECTION_READONLY)
    const db = existing.result
      ? await sqlite.retrieveConnection(DB_NAME, CONNECTION_READONLY)
      : await sqlite.createConnection(
          DB_NAME,
          USE_SQLCIPHER_ENCRYPTION,
          ENCRYPTION_MODE,
          DB_VERSION,
          CONNECTION_READONLY,
        )

    await db.open()
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        owner TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        due_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)

    await ensureLocalDemoSeed(db)
    return db
  })()

  return dbPromise
}

/**
 * Use on-device SQLite for iOS/Android so APK/IPA builds work without a reachable HTTP API.
 * Opt out with VITE_MOBILE_LOCAL_DB=false (or 0 / no / off), or bake a non-empty VITE_API_BASE (e.g. emulator
 * `http://10.0.2.2:8081`) so the app uses HTTP instead of SQLCipher.
 */
function authErr(status: number, message: string, code?: string): never {
  const e = new Error(message) as Error & { status: number; code?: string }
  e.status = status
  if (code) e.code = code
  throw e
}

function validStrongPasswordLocal(password: string): boolean {
  if (password.length < 10) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[0-9]/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  return true
}

async function getSessionUserId(db: SQLiteDBConnection): Promise<string | null> {
  const r = await db.query(`SELECT value FROM app_meta WHERE key = ?`, [META_SESSION_USER])
  const row = r.values?.[0] as Record<string, unknown> | undefined
  if (!row?.value) return null
  const v = String(row.value).trim()
  return v || null
}

async function setSessionUserId(db: SQLiteDBConnection, userId: string | null): Promise<void> {
  if (!userId) {
    await db.run(`DELETE FROM app_meta WHERE key = ?`, [META_SESSION_USER])
    return
  }
  await db.run(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [META_SESSION_USER, userId])
}

export async function getLocalSessionUser(): Promise<AuthUser | null> {
  const db = await getDb()
  const sid = await getSessionUserId(db)
  if (!sid) return null
  const r = await db.query(
    `SELECT id, email, username, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?`,
    [sid],
  )
  const row = r.values?.[0]
  return row ? rowToAuthUser(row as Record<string, unknown>) : null
}

export async function loginLocal(payload: AuthPayload): Promise<AuthUser> {
  const db = await getDb()
  const email = payload.email.trim().toLowerCase()
  const r = await db.query(
    `SELECT id, email, username, first_name, last_name, role, created_at, updated_at, password_hash FROM users WHERE lower(email) = ?`,
    [email],
  )
  const row = r.values?.[0] as Record<string, unknown> | undefined
  if (!row) {
    authErr(401, 'Invalid email or password', 'authentication_required')
  }
  const attemptedPassword = payload.password.trim()
  const storedHash = String(row.password_hash)
  const ok = await verifyPasswordArgon2id(attemptedPassword, storedHash)
  const isSeedAlias =
    attemptedPassword === 'AdminPass123!' &&
    email.endsWith('@example.gov') &&
    (await verifyPasswordArgon2id(DEMO_SEED_DEMO_PASSWORD, storedHash))
  if (!ok && !isSeedAlias) {
    authErr(401, 'Invalid email or password', 'authentication_required')
  }
  const { password_hash: _ignored, ...safe } = row as Record<string, unknown> & { password_hash: string }
  const user = rowToAuthUser(safe as Record<string, unknown>)
  await setSessionUserId(db, user.id)
  return user
}

export async function registerLocal(payload: AuthPayload): Promise<AuthUser> {
  const email = payload.email.trim()
  const password = payload.password.trim()
  const username = payload.username?.trim() ?? ''
  const firstName = payload.firstName?.trim() ?? ''
  const lastName = payload.lastName?.trim() ?? ''
  if (!email) authErr(400, 'Email is required', 'email_required')
  if (!email.includes('@')) authErr(400, 'Enter a valid email address', 'invalid_email')
  if (!username) authErr(400, 'Display name is required', 'username_required')
  if (!firstName) authErr(400, 'First name is required', 'first_name_required')
  if (!lastName) authErr(400, 'Last name is required', 'last_name_required')
  if (!password) authErr(400, 'Password is required', 'password_required')
  if (password.length < 10) authErr(400, 'Password must be at least 10 characters', 'password_too_short')
  if (!validStrongPasswordLocal(password)) authErr(400, 'Password must include one uppercase letter, one number, and one special character', 'password_weak')

  const db = await getDb()
  const dup = await db.query(`SELECT id FROM users WHERE lower(email) = ? OR lower(username) = ?`, [
    email.toLowerCase(),
    username.toLowerCase(),
  ])
  if ((dup.values?.length ?? 0) > 0) {
    authErr(400, 'Email or display name is already in use', 'validation_error')
  }

  const id = generateId()
  const hash = await hashPasswordArgon2id(password)
  const now = nowIso()
  await db.run(
    `INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'viewer', ?, ?)`,
    [id, email, username, firstName, lastName, hash, now, now],
  )
  const user: AuthUser = {
    id,
    email,
    username,
    firstName,
    lastName,
    role: 'viewer',
    createdAt: now,
    updatedAt: now,
  }
  await setSessionUserId(db, id)
  return user
}

export async function logoutLocal(): Promise<void> {
  const db = await getDb()
  await setSessionUserId(db, null)
}

export async function listUserDisplayNamesLocal(): Promise<{ displayNames: string[] }> {
  const db = await getDb()
  const r = await db.query(`SELECT username FROM users ORDER BY LOWER(username)`)
  const names = (r.values ?? []).map((row) => String((row as Record<string, unknown>).username))
  return { displayNames: names }
}

export async function recoverPasswordLocal(payload: RecoverPasswordPayload): Promise<RecoverPasswordResponse> {
  const db = await getDb()
  const email = payload.email.trim().toLowerCase()
  if (!email) {
    authErr(400, 'Email is required', 'email_required')
  }
  const r = await db.query(`SELECT id FROM users WHERE lower(email) = ?`, [email])
  const exists = (r.values?.length ?? 0) > 0
  if (!exists) {
    return { status: 'if_account_exists' }
  }
  return {
    status: 'ok',
    message:
      'Offline demo: email is not sent from the device. Use the shared demo password documented for staging builds, or contact your administrator.',
  }
}

/**
 * Native-only: use on-device SQLCipher when enabled.
 * - Explicit `VITE_MOBILE_LOCAL_DB=true` (etc.) → local DB.
 * - Explicit `false` / `0` / `no` / `off` → remote HTTP (`VITE_API_BASE` / default).
 * - **Unset:** if `VITE_API_BASE` was set at build time (non-empty), assume remote API (e.g. `run-android.sh` + emulator);
 *   otherwise default to local self-contained demo (release APKs with no API URL).
 */
export function isNativeMobileSQLiteEnabled(): boolean {
  if (Capacitor.getPlatform() === 'web') {
    return false
  }
  const flag = String(import.meta.env.VITE_MOBILE_LOCAL_DB ?? '').toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'no' || flag === 'off') {
    return false
  }
  if (flag === 'true' || flag === '1' || flag === 'yes' || flag === 'on') {
    return true
  }
  const apiBase = String(import.meta.env.VITE_API_BASE ?? '').trim()
  if (apiBase.length > 0) {
    return false
  }
  return true
}

export async function listTasksLocal(): Promise<Task[]> {
  const db = await getDb()
  const result = await db.query(`
    SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
    FROM tasks
    ORDER BY due_at ASC, id ASC;
  `)
  return (result.values ?? []).map((row) => toTask(row as Record<string, unknown>))
}

export async function createTaskLocal(payload: CreateTaskPayload): Promise<Task> {
  const db = await getDb()
  const id = generateId()
  const now = nowIso()
  const task: Task = {
    id,
    title: payload.title.trim(),
    description: payload.description ?? null,
    status: normalizeStatus(payload.status),
    priority: normalizePriority(payload.priority),
    owner: payload.owner?.trim() ?? '',
    tags: payload.tags ?? [],
    dueAt: payload.dueAt,
    createdAt: now,
    updatedAt: now,
  }

  await db.run(
    `
      INSERT INTO tasks (id, title, description, status, priority, owner, tags, due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      task.id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.owner,
      stringifyTags(task.tags),
      task.dueAt,
      task.createdAt,
      task.updatedAt,
    ],
  )

  return task
}

async function getTaskByIdLocal(id: string): Promise<Task | null> {
  const db = await getDb()
  const result = await db.query(
    `
      SELECT id, title, description, status, priority, owner, tags, due_at, created_at, updated_at
      FROM tasks
      WHERE id = ?;
    `,
    [id],
  )
  const row = result.values?.[0]
  return row ? toTask(row as Record<string, unknown>) : null
}

export async function updateTaskStatusLocal(id: string, payload: UpdateStatusPayload): Promise<Task> {
  const db = await getDb()
  const status = normalizeStatus(payload.status)
  const updatedAt = nowIso()
  await db.run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?;`, [status, updatedAt, id])
  const updated = await getTaskByIdLocal(id)
  if (!updated) throw new Error('Task not found')
  return updated
}

export async function updateTaskLocal(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const current = await getTaskByIdLocal(id)
  if (!current) throw new Error('Task not found')

  const next: Task = {
    ...current,
    title: payload.title?.trim() ?? current.title,
    description: payload.description === undefined ? current.description : payload.description,
    status: payload.status ?? current.status,
    priority: payload.priority ?? current.priority,
    tags: payload.tags ?? current.tags,
    updatedAt: nowIso(),
  }

  const db = await getDb()
  await db.run(
    `
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, tags = ?, updated_at = ?
      WHERE id = ?;
    `,
    [
      next.title,
      next.description,
      next.status,
      next.priority,
      stringifyTags(next.tags),
      next.updatedAt,
      id,
    ],
  )
  return next
}

export async function deleteTaskLocal(id: string): Promise<void> {
  const db = await getDb()
  await db.run(`DELETE FROM tasks WHERE id = ?;`, [id])
}
