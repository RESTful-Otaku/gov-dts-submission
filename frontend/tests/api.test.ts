import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_BASE = 'http://localhost:8080'

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof globalThis.fetch | undefined
  let api: typeof import('../src/lib/api')

  beforeEach(() => {
    // Ensure the base URL is stable regardless of developer shell env.
    process.env.VITE_API_BASE = DEFAULT_BASE
    fetchMock = vi.fn()
    originalFetch = globalThis.fetch
    ;(globalThis as { fetch?: typeof globalThis.fetch }).fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  afterEach(() => {
    if (api?.clearApiAuthContext) {
      api.clearApiAuthContext()
    }
    if (originalFetch) {
      globalThis.fetch = originalFetch
      return
    }
    delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch
  })

  describe('healthReady', () => {
    it('returns status when ready', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ready' }),
      })
      const result = await api.healthReady()
      expect(result).toEqual({ status: 'ready' })
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/ready$/), expect.any(Object))
    })

    it('throws ApiError on failure', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })
      await expect(api.healthReady()).rejects.toThrow(api.ApiError)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })
      const err = await api.healthReady().catch((e) => e)
      expect(err).toBeInstanceOf(api.ApiError)
      expect(err).toMatchObject({ status: 503, message: 'Service unavailable' })
    })
  })

  describe('listUserDisplayNames', () => {
    it('returns displayNames from API', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ displayNames: ['Ada Lovelace', 'Grace Hopper'] }),
      })
      const result = await api.listUserDisplayNames()
      expect(result).toEqual({ displayNames: ['Ada Lovelace', 'Grace Hopper'] })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/users\/display-names$/),
        expect.any(Object),
      )
    })
  })

  describe('listTasks', () => {
    it('returns tasks array', async () => {
      api = await import('../src/lib/api')
      const tasks = [{ id: '1', title: 'Task', status: 'todo', dueAt: '2026-01-01T00:00:00Z', createdAt: '', updatedAt: '' }]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tasks),
      })
      const result = await api.listTasks()
      expect(result).toEqual(tasks)
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/tasks\?limit=200&offset=0$/), expect.any(Object))
    })

    it('serializes server-query params', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
      await api.listTasks({
        limit: 50,
        offset: 10,
        q: 'alpha',
        status: 'in_progress',
        priority: 'high',
        owner: 'Caseworker A',
        tag: 'evidence',
        sort: 'title',
        order: 'desc',
      })
      const url = String(fetchMock.mock.calls[0]?.[0] ?? '')
      expect(url).toContain('/api/tasks?')
      expect(url).toContain('limit=50')
      expect(url).toContain('offset=10')
      expect(url).toContain('q=alpha')
      expect(url).toContain('status=in_progress')
      expect(url).toContain('priority=high')
      expect(url).toContain('owner=Caseworker+A')
      expect(url).toContain('tag=evidence')
      expect(url).toContain('sort=title')
      expect(url).toContain('order=desc')
    })
  })

  describe('createTask', () => {
    it('sends POST with payload and returns created task', async () => {
      api = await import('../src/lib/api')
      const payload = { title: 'New', status: 'todo' as const, dueAt: '2026-01-01T00:00:00Z' }
      const created = { ...payload, id: 'new-id', createdAt: '', updatedAt: '' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(created),
      })
      const result = await api.createTask(payload)
      expect(result).toEqual(created)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/tasks$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      )
    })
  })

  describe('updateTaskStatus', () => {
    it('sends PATCH to task path', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'id1', status: 'done', title: 'T', dueAt: '', createdAt: '', updatedAt: '' }),
      })
      await api.updateTaskStatus('id1', { status: 'done' })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/tasks\/id1$/),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'done' }),
        })
      )
    })
  })

  describe('auth transport headers', () => {
    it('sends bearer token, audience, and issuer when runtime auth context is set', async () => {
      api = await import('../src/lib/api')
      api.setApiAuthContext({
        bearerToken: 'token-123',
        audience: 'mobile-app',
        issuer: 'issuer-a',
      })
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
      await api.listTasks()
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer token-123')
      expect(headers['X-API-Audience']).toBe('mobile-app')
      expect(headers['X-API-Issuer']).toBe('issuer-a')
    })
  })

  describe('deleteTask', () => {
    it('sends DELETE and returns void', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({ ok: true, status: 204 })
      await api.deleteTask('id1')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/tasks\/id1$/),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('updateTask', () => {
    it('sends PUT with partial payload', async () => {
      api = await import('../src/lib/api')
      const updated = {
        id: 'id1',
        title: 'Renamed',
        status: 'todo' as const,
        dueAt: '',
        createdAt: '',
        updatedAt: '',
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(updated),
      })
      const result = await api.updateTask('id1', { title: 'Renamed' })
      expect(result.title).toBe('Renamed')
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/tasks\/id1$/),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'Renamed' }),
        }),
      )
    })
  })

  describe('request error handling', () => {
    it('uses JSON error body when present', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Unprocessable' }),
      })
      await expect(api.listTasks()).rejects.toMatchObject({
        message: 'Unprocessable',
        status: 422,
      })
    })

    it('falls back to generic message when JSON is not an object', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
      })
      await expect(api.listTasks()).rejects.toMatchObject({
        message: 'Request failed with status 500',
        status: 500,
      })
    })

    it('falls back when response body is invalid JSON', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('bad json')),
      })
      await expect(api.listTasks()).rejects.toMatchObject({
        message: 'Request failed with status 502',
        status: 502,
      })
    })

    it('stores machine-readable error code on ApiError', async () => {
      api = await import('../src/lib/api')
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'task was modified concurrently; reload and retry', code: 'task_conflict' }),
      })
      const err = await api.listTasks().catch((e) => e)
      expect(err).toBeInstanceOf(api.ApiError)
      expect(err).toMatchObject({ status: 409, code: 'task_conflict' })
    })
  })

  describe('ApiError', () => {
    it('extends Error and has status', async () => {
      const { ApiError } = await import('../src/lib/api')
      const err = new ApiError({ status: 404, message: 'Not found' })
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(404)
      expect(err.message).toBe('Not found')
      expect(err.name).toBe('ApiError')
    })
  })

  describe('apiErrorMessage', () => {
    it('maps known backend error codes to friendly copy', async () => {
      const { ApiError, apiErrorMessage } = await import('../src/lib/api')
      const err = new ApiError({ status: 409, message: 'raw', code: 'task_conflict' })
      expect(apiErrorMessage(err)).toBe('The task changed on the server. Reload and retry.')
    })

    it('falls back to API message for unknown codes', async () => {
      const { ApiError, apiErrorMessage } = await import('../src/lib/api')
      const err = new ApiError({ status: 500, message: 'custom', code: 'unknown_code' })
      expect(apiErrorMessage(err)).toBe('custom')
    })
  })
})

