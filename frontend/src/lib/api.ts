export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority?: TaskPriority
  owner?: string
  tags?: string[]
  dueAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateTaskPayload {
  title: string
  description?: string | null
  status: TaskStatus
  priority?: TaskPriority
  owner?: string
  tags?: string[]
  dueAt: string
}

export interface UpdateStatusPayload {
  status: TaskStatus
}

export interface UpdateTaskPayload {
  title?: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
}

export interface ApiErrorDetails {
  status: number
  message: string
}

export interface ListTasksParams {
  limit?: number
  offset?: number
}

export class ApiError extends Error {
  status: number

  constructor(details: ApiErrorDetails) {
    super(details.message)
    this.name = 'ApiError'
    this.status = details.status
  }
}

import {
  createTaskLocal,
  deleteTaskLocal,
  isNativeMobileSQLiteEnabled,
  listTasksLocal,
  updateTaskLocal,
  updateTaskStatusLocal,
} from './mobile-sqlite'

/**
 * Dev ergonomics:
 * - In dev, prefer same-origin `/api/*` and let Vite proxy to the local backend.
 *   This avoids CORS issues and avoids a stale `.env` (e.g. LAN IP) breaking `scripts/run.sh`.
 * - In production builds (Capacitor, docker, preview), use VITE_API_BASE when provided.
 * - On native Capacitor, task APIs use local SQLite by default (see mobile-sqlite); health skips HTTP in that mode.
 */
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080')

/** Resolve at call time so Capacitor native bridge is always present (avoids rare init-order bugs). */
function useLocalMobileDb(): boolean {
  return isNativeMobileSQLiteEnabled()
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) {
        message = body.error
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError({ status: res.status, message })
  }

  if (res.status === 204) {
    // No content
    return undefined as T
  }

  return (await res.json()) as T
}

export function listTasks(params: ListTasksParams = {}): Promise<Task[]> {
  if (useLocalMobileDb()) {
    return listTasksLocal()
  }
  const limit = params.limit ?? 200
  const offset = params.offset ?? 0
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return request<Task[]>(`/api/tasks?${search.toString()}`)
}

export function createTask(payload: CreateTaskPayload): Promise<Task> {
  if (useLocalMobileDb()) {
    return createTaskLocal(payload)
  }
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaskStatus(id: string, payload: UpdateStatusPayload): Promise<Task> {
  if (useLocalMobileDb()) {
    return updateTaskStatusLocal(id, payload)
  }
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  if (useLocalMobileDb()) {
    return updateTaskLocal(id, payload)
  }
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTask(id: string): Promise<void> {
  if (useLocalMobileDb()) {
    return deleteTaskLocal(id)
  }
  return request<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  })
}

export function healthReady(): Promise<{ status: string }> {
  if (useLocalMobileDb()) {
    return Promise.resolve({ status: 'ready' })
  }
  return request<{ status: string }>('/api/ready')
}

