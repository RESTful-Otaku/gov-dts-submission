import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createTask, deleteTask, healthReady, listTasks, updateTask, updateTaskStatus } from './api'

// API uses import.meta.env.VITE_API_BASE ?? 'http://localhost:8080' at build time
const DEFAULT_BASE = 'http://localhost:8080'

describe('api', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('healthReady', () => {
    it('returns status when ready', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ready' }),
      })
      const result = await healthReady()
      expect(result).toEqual({ status: 'ready' })
      expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_BASE}/api/ready`, expect.any(Object))
    })

    it('throws ApiError on failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })
      await expect(healthReady()).rejects.toThrow(ApiError)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: 'Service unavailable' }),
      })
      const err = await healthReady().catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect(err).toMatchObject({ status: 503, message: 'Service unavailable' })
    })
  })

  describe('listTasks', () => {
    it('returns tasks array', async () => {
      const tasks = [{ id: '1', title: 'Task', status: 'todo', dueAt: '2026-01-01T00:00:00Z', createdAt: '', updatedAt: '' }]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tasks),
      })
      const result = await listTasks()
      expect(result).toEqual(tasks)
      expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_BASE}/api/tasks`, expect.any(Object))
    })
  })

  describe('createTask', () => {
    it('sends POST with payload and returns created task', async () => {
      const payload = { title: 'New', status: 'todo' as const, dueAt: '2026-01-01T00:00:00Z' }
      const created = { ...payload, id: 'new-id', createdAt: '', updatedAt: '' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(created),
      })
      const result = await createTask(payload)
      expect(result).toEqual(created)
      expect(fetchMock).toHaveBeenCalledWith(
        `${DEFAULT_BASE}/api/tasks`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      )
    })
  })

  describe('updateTaskStatus', () => {
    it('sends PATCH to task path', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'id1', status: 'done', title: 'T', dueAt: '', createdAt: '', updatedAt: '' }),
      })
      await updateTaskStatus('id1', { status: 'done' })
      expect(fetchMock).toHaveBeenCalledWith(
        `${DEFAULT_BASE}/api/tasks/id1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'done' }),
        })
      )
    })
  })

  describe('deleteTask', () => {
    it('sends DELETE and returns void', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 204 })
      await deleteTask('id1')
      expect(fetchMock).toHaveBeenCalledWith(
        `${DEFAULT_BASE}/api/tasks/id1`,
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('ApiError', () => {
    it('extends Error and has status', () => {
      const err = new ApiError({ status: 404, message: 'Not found' })
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(404)
      expect(err.message).toBe('Not found')
      expect(err.name).toBe('ApiError')
    })
  })
})

