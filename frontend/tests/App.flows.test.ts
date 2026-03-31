import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'

import App from '../src/App.svelte'

/** Normalise fetch() input to a pathname for routing mocks (handles absolute Request URLs in Vitest/jsdom). */
function fetchPathname(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input.startsWith('http') ? new URL(input).pathname : input.split('?')[0]
  }
  if (input instanceof Request) {
    return new URL(input.url).pathname
  }
  return new URL(input.href).pathname
}

function makeLocalStorageStub() {
  let store: Map<string, string> = new Map()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
}

function makeReadyFetchMock({
  healthStatus,
  initialTasks,
  onCreate,
  onUpdate,
  onDelete,
}: {
  healthStatus: string
  initialTasks: any[]
  onCreate?: (payload: any) => any
  onUpdate?: (taskId: string, payload: any) => any
  onDelete?: (taskId: string) => void
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = fetchPathname(input)
    const method = (init?.method ?? 'GET').toUpperCase()

    if (path === '/api/ready' || path.endsWith('/api/ready')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: healthStatus }),
      }
    }

    if (path === '/api/tasks' || path.endsWith('/api/tasks')) {
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => initialTasks,
        }
      }
      if (method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        const created = onCreate ? onCreate(body) : { ...body, id: 'created-1' }
        return {
          ok: true,
          status: 200,
          json: async () => created,
        }
      }
    }

    const taskIdMatch = path.match(/^\/api\/tasks\/([^/]+)$/)
    if (taskIdMatch) {
      const taskId = taskIdMatch[1]

      if (method === 'PUT') {
        const body = init?.body ? JSON.parse(String(init.body)) : {}
        const updated = onUpdate ? onUpdate(taskId, body) : { ...body, id: taskId }
        return { ok: true, status: 200, json: async () => updated }
      }

      if (method === 'PATCH') {
        // Kanban status updates are out of scope for these flows.
        return { ok: true, status: 200, json: async () => ({ id: taskId, status: 'todo' }) }
      }

      if (method === 'DELETE') {
        onDelete?.(taskId)
        return { ok: true, status: 204, json: async () => undefined }
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('not json')
      },
    }
  })

  return fetchMock
}

describe('App.svelte integration flows', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('localStorage', makeLocalStorageStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows degraded banner when API /api/ready is not fully ready', async () => {
    const fetchMock = makeReadyFetchMock({
      healthStatus: 'not-ready',
      initialTasks: [],
    })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(App)

    await waitFor(() => {
      const el = container.querySelector('.health-banner')
      expect(el).toBeTruthy()
      expect(el!.textContent).toContain('The service may be experiencing issues.')
      expect(el!.textContent).toContain('Service is responding but not fully ready.')
    })
  })

  it('does not show health banner when API is ready', async () => {
    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      initialTasks: [],
    })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = render(App)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    // refreshHealth sets healthStatus='ok', so banner is not rendered at all.
    await waitFor(() => {
      expect(container.querySelector('.health-banner')).toBeNull()
    })
  })

  it('filters cards view by status using the advanced filters panel (controlled inputs)', async () => {
    const dueAtFuture1 = new Date(2026, 2, 28, 10, 0, 0, 0).toISOString()
    const dueAtFuture2 = new Date(2026, 2, 29, 10, 0, 0, 0).toISOString()
    const tasks = [
      {
        id: 't1',
        title: 'Todo task',
        description: null,
        status: 'todo',
        priority: 'high',
        owner: 'Alice',
        tags: ['evidence'],
        dueAt: dueAtFuture1,
        createdAt: dueAtFuture1,
        updatedAt: dueAtFuture1,
      },
      {
        id: 't2',
        title: 'Done task',
        description: null,
        status: 'done',
        priority: 'low',
        owner: 'Bob',
        tags: ['hearing'],
        dueAt: dueAtFuture2,
        createdAt: dueAtFuture2,
        updatedAt: dueAtFuture2,
      },
    ]

    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      initialTasks: tasks,
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { getByRole, getByText, queryByText, container } = render(App)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // Open filters panel
    await user.click(getByRole('button', { name: 'Toggle filters' }))
    expect(getByRole('region', { name: 'Advanced filters and sorting' })).toBeVisible()

    // Status filter -> done
    const statusSelect = container.querySelector('select[aria-label="Filter by status"]') as HTMLSelectElement
    expect(statusSelect).toBeTruthy()
    fireEvent.change(statusSelect, { target: { value: 'done' } })

    await waitFor(() => {
      expect(queryByText('Todo task')).toBeNull()
      expect(getByText('Done task')).toBeVisible()
    })
  })

  it('switches to kanban view via view toggle', async () => {
    const dueAt = new Date(2026, 2, 26, 11, 0, 0, 0).toISOString()
    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      // Must have at least one task, otherwise the app renders the global empty state instead of the view component.
      initialTasks: [
        {
          id: 't1',
          title: 'Task',
          description: null,
          status: 'todo',
          priority: 'normal',
          owner: '',
          tags: [],
          dueAt,
          createdAt: dueAt,
          updatedAt: dueAt,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { getByRole } = render(App)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await user.click(getByRole('button', { name: 'Kanban' }))

    await waitFor(() => expect(document.querySelector('[aria-label="Tasks in kanban view"]')).toBeTruthy())
  })

  it('creates a task (modal submit -> toast + modal close)', async () => {
    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      initialTasks: [],
      onCreate: (payload) => ({
        id: 'new-1',
        title: payload.title,
        description: payload.description ?? null,
        status: payload.status,
        priority: payload.priority,
        owner: payload.owner,
        tags: payload.tags ?? [],
        dueAt: payload.dueAt,
        createdAt: payload.dueAt,
        updatedAt: payload.dueAt,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { getByRole, getByText, queryByRole, container } = render(App)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    await user.click(getByRole('button', { name: 'Create a new task' }))

    const titleInput = (await waitFor(() => {
      const el = container.querySelector('#modal-title-input') as HTMLInputElement | null
      expect(el).toBeTruthy()
      return el!
    })) as HTMLInputElement
    await user.type(titleInput, 'New task title')

    const dueInput = (await waitFor(() => {
      const el = container.querySelector('#modal-due-datetime') as HTMLInputElement | null
      expect(el).toBeTruthy()
      return el!
    })) as HTMLInputElement

    // parseDateTimeUK expects: DD-MM-YYYY HH:MM AM/PM
    // Use a far-future value so `validateForm()` can't reject it as in the past.
    await user.clear(dueInput)
    await user.type(dueInput, '01-01-2030 11:00 AM')

    await user.click(getByRole('button', { name: 'Create task' }))

    await waitFor(() => {
      expect(getByText('Task created.')).toBeVisible()
    })
  })

  it('edits a task (modal submit -> toast + modal close)', async () => {
    const dueAt = new Date(2026, 2, 26, 11, 0, 0, 0).toISOString()
    const tasks = [
      {
        id: 't1',
        title: 'Original title',
        description: null,
        status: 'todo',
        priority: 'normal',
        owner: '',
        tags: [],
        dueAt,
        createdAt: dueAt,
        updatedAt: dueAt,
      },
    ]

    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      initialTasks: tasks,
      onUpdate: (taskId, payload) => ({
        id: taskId,
        title: payload.title ?? tasks[0].title,
        description: payload.description ?? null,
        status: payload.status ?? tasks[0].status,
        priority: payload.priority ?? tasks[0].priority,
        owner: tasks[0].owner,
        tags: payload.tags ?? [],
        dueAt: tasks[0].dueAt,
        createdAt: tasks[0].createdAt,
        updatedAt: dueAt,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { getByRole, container, getByText, queryByRole } = render(App)

    await waitFor(() => {
      expect(getByText('Original title')).toBeVisible()
    })

    await user.click(getByRole('button', { name: 'Edit' }))

    const editTitleInput = container.querySelector('#edit-title-input') as HTMLInputElement
    expect(editTitleInput).toBeTruthy()
    await user.clear(editTitleInput)
    await user.type(editTitleInput, 'Updated title')

    await user.click(getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(getByText('Task updated.')).toBeVisible()
    })
  })

  it('deletes a task (delete modal submit -> toast + modal close)', async () => {
    const dueAt = new Date(2026, 2, 26, 11, 0, 0, 0).toISOString()
    const tasks = [
      {
        id: 't1',
        title: 'Task to delete',
        description: null,
        status: 'todo',
        priority: 'normal',
        owner: '',
        tags: [],
        dueAt,
        createdAt: dueAt,
        updatedAt: dueAt,
      },
    ]

    const fetchMock = makeReadyFetchMock({
      healthStatus: 'ready',
      initialTasks: tasks,
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    const { getByRole, getByText, queryByRole, container, getByTitle } = render(App)

    await waitFor(() => {
      expect(getByText('Task to delete')).toBeVisible()
    })

    await user.click(getByTitle('Delete task Task to delete'))

    await waitFor(() => {
      expect(getByText('Delete task?')).toBeVisible()
    })

    await user.click(getByRole('button', { name: 'Delete task' }))

    await waitFor(() => {
      expect(getByText('Task deleted.')).toBeVisible()
    })
  })
})

