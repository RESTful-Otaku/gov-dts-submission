import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEFAULT_BASE = 'http://localhost:8080'

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let api: typeof import('../src/lib/api')

  beforeEach(() => {
    // Ensure the base URL is stable regardless of developer shell env.
    process.env.VITE_API_BASE = DEFAULT_BASE
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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
})

