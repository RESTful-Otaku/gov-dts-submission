import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android' | 'web',
  secretStored: false,
  tasks: [] as Row[],
  meta: new Map<string, string>(),
}))

class FakeDb {
  async open(): Promise<void> {}
  async execute(_sql: string): Promise<void> {}

  async query(sql: string, params: unknown[] = []): Promise<{ values: Row[] }> {
    if (sql.includes('SELECT value FROM app_meta WHERE key = ?')) {
      const key = String(params[0] ?? '')
      const value = state.meta.get(key)
      return { values: value ? [{ value }] : [] }
    }
    if (sql.includes('SELECT COUNT(*) AS count FROM tasks')) {
      return { values: [{ count: state.tasks.length }] }
    }
    if (sql.includes('FROM tasks') && sql.includes('WHERE id = ?')) {
      const row = state.tasks.find((t) => t.id === params[0])
      return { values: row ? [row] : [] }
    }
    if (sql.includes('FROM tasks') && sql.includes('ORDER BY due_at ASC, id ASC')) {
      const out = [...state.tasks].sort((a, b) => {
        const due = String(a.due_at).localeCompare(String(b.due_at))
        return due !== 0 ? due : String(a.id).localeCompare(String(b.id))
      })
      return { values: out }
    }
    return { values: [] }
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes('INSERT INTO tasks')) {
      state.tasks.push({
        id: String(params[0]),
        title: String(params[1]),
        description: params[2] ?? null,
        status: String(params[3]),
        priority: String(params[4]),
        owner: String(params[5] ?? ''),
        tags: String(params[6] ?? '[]'),
        due_at: String(params[7]),
        created_at: String(params[8]),
        updated_at: String(params[9]),
      })
      return
    }
    if (sql.includes('INSERT INTO app_meta') || sql.includes('INSERT OR REPLACE INTO app_meta')) {
      state.meta.set(String(params[0]), String(params[1]))
      return
    }
    if (sql.includes('UPDATE tasks SET status = ?')) {
      const [status, updatedAt, id] = params
      const row = state.tasks.find((t) => t.id === id)
      if (row) {
        row.status = status
        row.updated_at = updatedAt
      }
      return
    }
    if (sql.includes('UPDATE tasks') && sql.includes('SET title = ?')) {
      const [title, description, status, priority, tags, updatedAt, id] = params
      const row = state.tasks.find((t) => t.id === id)
      if (row) {
        row.title = title
        row.description = description
        row.status = status
        row.priority = priority
        row.tags = tags
        row.updated_at = updatedAt
      }
      return
    }
    if (sql.includes('DELETE FROM tasks WHERE id = ?')) {
      state.tasks = state.tasks.filter((t) => t.id !== params[0])
    }
  }
}

const sharedDb = new FakeDb()

class FakeSQLiteConnection {
  async checkConnectionsConsistency(): Promise<void> {}
  async isConnection(): Promise<{ result: boolean }> {
    return { result: false }
  }
  async retrieveConnection(): Promise<FakeDb> {
    return sharedDb
  }
  async createConnection(): Promise<FakeDb> {
    return sharedDb
  }
  async isSecretStored(): Promise<{ result: boolean }> {
    return { result: state.secretStored }
  }
  async setEncryptionSecret(): Promise<void> {
    state.secretStored = true
  }
}

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => state.platform },
}))

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: FakeSQLiteConnection,
}))

describe('mobile sqlite data path', () => {
  beforeEach(async () => {
    vi.resetModules()
    state.platform = 'ios'
    state.secretStored = false
    state.tasks = []
    state.meta = new Map([['seed_local_demo_v3', 'already-seeded']])
    vi.stubEnv('VITE_MOBILE_DB_SECRET', 'test-secret')
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', 'true')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'))
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-fixed' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('creates and lists tasks in deterministic order', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    await mod.createTaskLocal({
      title: '  B task  ',
      status: 'todo',
      dueAt: '2026-04-08T09:00:00.000Z',
    })
    await mod.createTaskLocal({
      title: 'A task',
      status: 'todo',
      dueAt: '2026-04-07T13:00:00.000Z',
    })
    const list = await mod.listTasksLocal()
    expect(list).toHaveLength(2)
    expect(list[0].title).toBe('A task')
    expect(list[1].title).toBe('B task')
  })

  it('updates status and returns updated task', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    const created = await mod.createTaskLocal({
      title: 'Status task',
      status: 'todo',
      dueAt: '2026-04-08T09:00:00.000Z',
    })
    const updated = await mod.updateTaskStatusLocal(created.id, { status: 'done' })
    expect(updated.status).toBe('done')
  })

  it('merge-updates only provided fields', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    const created = await mod.createTaskLocal({
      title: 'Merge task',
      description: 'before',
      status: 'todo',
      priority: 'normal',
      tags: ['a'],
      dueAt: '2026-04-08T09:00:00.000Z',
    })
    const updated = await mod.updateTaskLocal(created.id, {
      title: '  after  ',
      tags: ['x', 'y'],
    })
    expect(updated.title).toBe('after')
    expect(updated.description).toBe('before')
    expect(updated.status).toBe('todo')
    expect(updated.priority).toBe('normal')
    expect(updated.tags).toEqual(['x', 'y'])
  })

  it('throws task not found for missing status update', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    await expect(mod.updateTaskStatusLocal('missing-id', { status: 'done' })).rejects.toThrow('Task not found')
  })

  it('deletes tasks idempotently', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    const created = await mod.createTaskLocal({
      title: 'Delete me',
      status: 'todo',
      dueAt: '2026-04-08T09:00:00.000Z',
    })
    await mod.deleteTaskLocal(created.id)
    await mod.deleteTaskLocal(created.id)
    const list = await mod.listTasksLocal()
    expect(list).toHaveLength(0)
  })

  it('falls back to empty tags for malformed stored tags JSON', async () => {
    const mod = await import('../src/lib/mobile-sqlite')
    await mod.createTaskLocal({
      title: 'Malformed tags',
      status: 'todo',
      dueAt: '2026-04-08T09:00:00.000Z',
    })
    state.tasks[0].tags = '{"bad":"shape"}'
    const list = await mod.listTasksLocal()
    expect(list[0].tags).toEqual([])
  })
})
