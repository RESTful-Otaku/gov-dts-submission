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

export class ApiError extends Error {
  status: number

  constructor(details: ApiErrorDetails) {
    super(details.message)
    this.name = 'ApiError'
    this.status = details.status
  }
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

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

export function listTasks(): Promise<Task[]> {
  return request<Task[]>('/api/tasks')
}

export function createTask(payload: CreateTaskPayload): Promise<Task> {
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaskStatus(id: string, payload: UpdateStatusPayload): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  })
}

export function healthReady(): Promise<{ status: string }> {
  return request<{ status: string }>('/api/ready')
}

