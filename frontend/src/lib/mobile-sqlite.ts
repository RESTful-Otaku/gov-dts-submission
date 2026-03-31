import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import type {
  CreateTaskPayload,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateStatusPayload,
  UpdateTaskPayload,
} from './api'

const DB_NAME = 'taskmanager'
const DB_VERSION = 1
const ENCRYPTION_MODE = 'no-encryption'
/** Arg 2 of createConnection: use SQLCipher (must stay false when ENCRYPTION_MODE is no-encryption). */
const USE_SQLCIPHER_ENCRYPTION = false
/** Arg 5 of createConnection / isConnection / retrieveConnection: false = read-write. */
const CONNECTION_READONLY = false

let dbPromise: Promise<SQLiteDBConnection> | null = null

type SeedTemplate = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  owner: string
  tags: string[]
  dueDays: number
}

const DEMO_TEMPLATES: SeedTemplate[] = [
  { title: 'Review case bundle', description: 'Check evidence and witness statements before the hearing.', status: 'todo', priority: 'high', owner: 'Sarah Chen', tags: ['evidence', 'bundle', 'hearing'], dueDays: 0 },
  { title: 'Prepare hearing notes', description: 'Summarise key points and authorities for the judge.', status: 'in_progress', priority: 'normal', owner: 'James Wilson', tags: ['hearing', 'judge', 'notes'], dueDays: 1 },
  { title: 'Chase respondent response', description: "Email respondent's solicitor for outstanding response.", status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['correspondence', 'respondent', 'deadline'], dueDays: 2 },
  { title: 'Draft order', description: 'Prepare draft order for judge approval.', status: 'in_progress', priority: 'high', owner: 'James Wilson', tags: ['draft', 'order', 'judge'], dueDays: 3 },
  { title: 'Update case management system', description: 'Enter latest hearing outcome and next steps.', status: 'done', priority: 'low', owner: 'Priya Patel', tags: ['cms', 'admin', 'data-entry'], dueDays: 0 },
  { title: 'Schedule case conference', description: 'Arrange case conference and send invites.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['conference', 'listing', 'diary'], dueDays: 5 },
  { title: 'Review safeguarding concerns', description: 'Review safeguarding notes and escalate if needed.', status: 'in_progress', priority: 'urgent', owner: 'James Wilson', tags: ['safeguarding', 'compliance', 'escalation'], dueDays: 1 },
  { title: 'Send directions to parties', description: 'Issue standard directions and file copy.', status: 'todo', priority: 'normal', owner: 'Priya Patel', tags: ['directions', 'correspondence', 'filing'], dueDays: 4 },
  { title: 'Prepare summary for judge', description: 'Create one-page case summary for pre-reading.', status: 'todo', priority: 'high', owner: 'Sarah Chen', tags: ['summary', 'hearing', 'pre-reading'], dueDays: 6 },
  { title: 'Check compliance with previous order', description: 'Confirm parties have complied with directions.', status: 'in_progress', priority: 'normal', owner: 'Priya Patel', tags: ['compliance', 'directions', 'follow-up'], dueDays: 7 },
  { title: 'File correspondence', description: 'File recent correspondence to digital case file.', status: 'done', priority: 'low', owner: 'James Wilson', tags: ['filing', 'admin', 'correspondence'], dueDays: 8 },
  { title: 'List case for review', description: 'Ensure 4-week review is listed and parties notified.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['listing', 'review', 'diary'], dueDays: 10 },
  { title: 'Confirm interpreter booking', description: 'Check interpreter confirmed and parties informed.', status: 'todo', priority: 'high', owner: 'James Wilson', tags: ['interpreter', 'hearing', 'accessibility'], dueDays: 9 },
  { title: 'Update hearing bundle index', description: 'Update index after new documents received.', status: 'in_progress', priority: 'normal', owner: 'Priya Patel', tags: ['bundle', 'hearing', 'index'], dueDays: 12 },
  { title: 'Arrange remote hearing link', description: 'Send video link and joining instructions to parties.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['remote', 'hearing', 'video'], dueDays: 11 },
  { title: 'Chase expert report', description: 'Follow up with expert for draft report.', status: 'in_progress', priority: 'normal', owner: 'James Wilson', tags: ['expert', 'evidence', 'report'], dueDays: 14 },
  { title: 'Record adjournment reasons', description: 'Enter adjournment reasons into case system.', status: 'done', priority: 'low', owner: 'Priya Patel', tags: ['admin', 'hearing', 'adjournment'], dueDays: 8 },
  { title: 'Close legacy paper file', description: 'Confirm closed and archived; update records.', status: 'done', priority: 'low', owner: 'Sarah Chen', tags: ['archive', 'admin', 'closure'], dueDays: 13 },
  { title: 'Check disclosure compliance', description: 'Ensure disclosure has been complied with.', status: 'todo', priority: 'normal', owner: 'James Wilson', tags: ['disclosure', 'compliance', 'audit'], dueDays: 18 },
  { title: 'Send reminder to applicant', description: 'Remind applicant of upcoming deadline.', status: 'todo', priority: 'normal', owner: 'Priya Patel', tags: ['correspondence', 'deadline', 'reminder'], dueDays: 20 },
  { title: 'Prepare chronology', description: 'Draft timeline of events for the bundle.', status: 'in_progress', priority: 'high', owner: 'Sarah Chen', tags: ['chronology', 'bundle', 'timeline'], dueDays: 21 },
  { title: 'Update contact details', description: "Verify and update parties' contact details.", status: 'done', priority: 'low', owner: 'James Wilson', tags: ['admin', 'contacts', 'data'], dueDays: 15 },
  { title: 'Confirm attendance of witnesses', description: 'Check witness attendance and availability.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['witnesses', 'hearing', 'attendance'], dueDays: 24 },
  { title: 'Redact sensitive information', description: 'Redact documents where required before disclosure.', status: 'in_progress', priority: 'high', owner: 'James Wilson', tags: ['redaction', 'disclosure', 'gdpr'], dueDays: 22 },
  { title: 'Upload audio recording', description: 'Upload hearing recording to case file.', status: 'done', priority: 'low', owner: 'Priya Patel', tags: ['audio', 'admin', 'recording'], dueDays: 16 },
  { title: 'Prepare directions questionnaire', description: 'Review and file directions questionnaire.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['questionnaire', 'directions', 'forms'], dueDays: 28 },
  { title: 'Flag urgent cases', description: 'Mark cases for priority handling and allocation.', status: 'in_progress', priority: 'urgent', owner: 'James Wilson', tags: ['urgent', 'allocation', 'triage'], dueDays: 17 },
  { title: 'Review pending applications', description: 'Scan and triage new applications.', status: 'todo', priority: 'normal', owner: 'Priya Patel', tags: ['applications', 'triage', 'intake'], dueDays: 19 },
  { title: 'Notify parties of decision', description: 'Send written decision and appeal rights.', status: 'done', priority: 'normal', owner: 'Sarah Chen', tags: ['decision', 'correspondence', 'appeal-rights'], dueDays: 30 },
  { title: 'Quality check case file', description: 'Run quality checklist and fix any gaps.', status: 'in_progress', priority: 'normal', owner: 'James Wilson', tags: ['quality', 'compliance', 'audit'], dueDays: 35 },
  { title: 'Liaise with legal team', description: 'Discuss merits and next steps with legal.', status: 'todo', priority: 'high', owner: 'Priya Patel', tags: ['legal', 'strategy', 'advisory'], dueDays: 42 },
  { title: 'Request extension of time', description: 'Consider and draft extension request if needed.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['deadline', 'directions', 'extension'], dueDays: 45 },
  { title: 'Prepare cost summary', description: 'Draft summary of costs for assessment.', status: 'in_progress', priority: 'low', owner: 'James Wilson', tags: ['costs', 'assessment', 'billing'], dueDays: 50 },
  { title: 'Arrange mediation', description: 'Contact mediation service and propose dates.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['mediation', 'listing', 'adr'], dueDays: 56 },
  { title: 'Finalise appeal bundle', description: 'Compile and index appeal bundle for filing.', status: 'todo', priority: 'high', owner: 'James Wilson', tags: ['appeal', 'bundle', 'index'], dueDays: 60 },
  { title: 'Chase outstanding disclosure', description: 'Follow up on any outstanding disclosure items.', status: 'in_progress', priority: 'normal', owner: 'Priya Patel', tags: ['disclosure', 'compliance', 'follow-up'], dueDays: 70 },
  { title: 'Pre-hearing review', description: 'Complete pre-hearing review and checklist.', status: 'todo', priority: 'normal', owner: 'Sarah Chen', tags: ['hearing', 'review', 'checklist'], dueDays: 77 },
  { title: 'Close case and archive', description: 'Final closure and archive once all steps complete.', status: 'todo', priority: 'low', owner: 'James Wilson', tags: ['archive', 'closure', 'completion'], dueDays: 84 },
]

function nowIso(): string {
  return new Date().toISOString()
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const rand = Math.random().toString(36).slice(2, 10)
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

async function getDb(): Promise<SQLiteDBConnection> {
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
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
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)

    const seedStatus = await db.query(`SELECT value FROM app_meta WHERE key = 'seed_demo_tasks_v1';`)
    if ((seedStatus.values?.length ?? 0) === 0) {
      const countRes = await db.query(`SELECT COUNT(*) AS count FROM tasks;`)
      const existingCount = taskRowCount(countRes)

      if (existingCount === 0) {
        const now = nowIso()
        for (const tmpl of DEMO_TEMPLATES) {
          await db.run(
            `
              INSERT INTO tasks (id, title, description, status, priority, owner, tags, due_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `,
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
        }
      }

      await db.run(`INSERT INTO app_meta (key, value) VALUES (?, ?);`, ['seed_demo_tasks_v1', nowIso()])
    }
    return db
  })()

  return dbPromise
}

/**
 * Use on-device SQLite for iOS/Android so APK/IPA builds work without a reachable HTTP API.
 * Opt out with VITE_MOBILE_LOCAL_DB=false (or 0 / no / off) when the native app should use VITE_API_BASE only.
 */
export function isNativeMobileSQLiteEnabled(): boolean {
  if (Capacitor.getPlatform() === 'web') {
    return false
  }
  const flag = String(import.meta.env.VITE_MOBILE_LOCAL_DB ?? '').toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'no' || flag === 'off') {
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
