import type { components } from './generated/openapi-types'

export type Task = components['schemas']['Task']
export type TaskStatus = Task['status']
export type TaskPriority = NonNullable<Task['priority']>
export type CreateTaskPayload = components['schemas']['CreateTaskRequest']
export type UpdateStatusPayload = components['schemas']['UpdateStatusRequest']
export type UpdateTaskPayload = components['schemas']['UpdateTaskRequest']
export type UserRole = 'viewer' | 'editor' | 'admin'
export interface AuthUser {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: UserRole
  createdAt: string
  updatedAt: string
}
export interface AuthPayload {
  email: string
  username?: string
  firstName?: string
  lastName?: string
  password: string
}
export interface RecoverPasswordPayload {
  email: string
}
export interface RecoverPasswordResponse {
  status: string
  token?: string
  resetUrl?: string
  /** Offline / demo builds may return user-facing guidance instead of email. */
  message?: string
}
export interface ResetPasswordPayload {
  token: string
  newPassword: string
}
export type AuditLogsSortField = 'created_at' | 'username' | 'action' | 'changed_fields'

export interface AuditLog {
  id: string
  userId: string
  username: string
  action: 'create' | 'edit' | 'delete' | string
  entityType: string
  entityId: string
  changedFields: string[]
  beforeJson?: string
  afterJson?: string
  rawJson: string
  createdAt: string
}

export interface ApiErrorDetails {
  status: number
  message: string
  code?: string
}

export interface ApiAuthContext {
  bearerToken?: string
  audience?: string
  issuer?: string
}

export interface ListTasksParams {
  limit?: number
  offset?: number
  q?: string
  status?: TaskStatus
  priority?: TaskPriority
  owner?: string
  tag?: string
  sort?: 'due' | 'title' | 'priority' | 'owner' | 'status' | 'tags' | 'created'
  order?: 'asc' | 'desc'
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(details: ApiErrorDetails) {
    super(details.message)
    this.name = 'ApiError'
    this.status = details.status
    this.code = details.code
  }
}

const API_ERROR_CODE_MESSAGES: Record<string, string> = {
  invalid_json_payload: 'The request payload is invalid JSON.',
  invalid_request_body: 'The request body could not be read.',
  request_too_large: 'The request payload is too large.',
  unsupported_media_type: 'Content-Type must be application/json.',
  invalid_task_id: 'The task ID is invalid.',
  invalid_due_at: 'Due date/time must be a valid RFC3339 timestamp.',
  invalid_pagination: 'Pagination parameters are invalid.',
  missing_update_fields: 'Provide at least one field to update.',
  validation_error: 'Please fix validation errors and try again.',
  email_required: 'Email is required.',
  invalid_email: 'Enter a valid email address.',
  username_required: 'Display name is required.',
  first_name_required: 'First name is required.',
  last_name_required: 'Last name is required.',
  password_required: 'Password is required.',
  password_too_short: 'Password must be at least 10 characters.',
  password_weak: 'Password must include one uppercase letter, one number, and one special character.',
  reset_token_required: 'Reset token is required.',
  new_password_required: 'New password is required.',
  new_password_too_short: 'New password must be at least 10 characters.',
  new_password_weak: 'New password must include one uppercase letter, one number, and one special character.',
  task_not_found: 'The task was not found.',
  task_conflict: 'The task changed on the server. Reload and retry.',
  missing_bearer_token: 'You are not signed in for this operation.',
  invalid_bearer_token: 'Your authentication token is invalid.',
  insufficient_permissions: 'You do not have permission for this action.',
  invalid_session: 'Your session could not be validated. Sign in again.',
  authentication_required: 'Sign in to continue.',
  invalid_token_audience: 'Authentication audience is invalid.',
  invalid_token_issuer: 'Authentication issuer is invalid.',
  auth_misconfigured: 'Service authentication is currently misconfigured.',
  invalid_auth_mode: 'Service authentication mode is invalid.',
  service_unavailable: 'Service is currently unavailable.',
  internal_error: 'An internal server error occurred.',
  user_creation_disabled: 'Creating users from the admin API is disabled.',
  user_not_found: 'That user was not found.',
  invalid_user_sort: 'That sort field is not valid for the user list.',
  invalid_user_role_filter: 'Role filter must be viewer, editor, or admin.',
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof ApiError) {
    if (error.code && API_ERROR_CODE_MESSAGES[error.code]) {
      return API_ERROR_CODE_MESSAGES[error.code]
    }
    return error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

import {
  createTaskLocal,
  deleteTaskLocal,
  getLocalSessionUser,
  isNativeMobileSQLiteEnabled,
  listTasksLocal,
  listUserDisplayNamesLocal,
  loginLocal,
  logoutLocal,
  recoverPasswordLocal,
  registerLocal,
  updateTaskLocal,
  updateTaskStatusLocal,
} from './mobile-sqlite'

/**
 * Dev ergonomics:
 * - In dev, prefer same-origin `/api/*` and let Vite proxy to the local backend.
 *   This avoids CORS issues and avoids a stale `.env` (e.g. LAN IP) breaking `scripts/run.sh`.
 * - In production builds (Capacitor, docker, preview), use VITE_API_BASE when provided.
 * - On native Capacitor, local SQLite is used when VITE_MOBILE_LOCAL_DB is affirmative, or when it is unset and
 *   VITE_API_BASE was not set at build (offline demo). If VITE_API_BASE is set (e.g. emulator host), HTTP is used.
 */
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE ?? 'http://localhost:8080')
const API_AUTH_TOKEN_ENV = import.meta.env.VITE_API_AUTH_TOKEN as string | undefined
const API_AUTH_AUDIENCE_ENV = import.meta.env.VITE_API_AUTH_AUDIENCE as string | undefined
const API_AUTH_ISSUER_ENV = import.meta.env.VITE_API_AUTH_ISSUER as string | undefined
let runtimeApiAuth: ApiAuthContext = {}

/** Resolve at call time so Capacitor native bridge is always present (avoids rare init-order bugs). */
function useLocalMobileDb(): boolean {
  return isNativeMobileSQLiteEnabled()
}

function raiseFromLocalAuth(e: unknown): never {
  if (e && typeof e === 'object' && 'status' in e) {
    const x = e as { status: unknown; message?: unknown; code?: unknown }
    if (typeof x.status === 'number') {
      throw new ApiError({
        status: x.status,
        message: typeof x.message === 'string' ? x.message : 'Request failed',
        code: typeof x.code === 'string' ? x.code : undefined,
      })
    }
  }
  throw e
}

export function setApiAuthContext(next: ApiAuthContext): void {
  runtimeApiAuth = { ...next }
}

export function clearApiAuthContext(): void {
  runtimeApiAuth = {}
}

function resolveApiAuthContext(): ApiAuthContext {
  const bearerToken = runtimeApiAuth.bearerToken?.trim() || API_AUTH_TOKEN_ENV?.trim() || undefined
  const audience = runtimeApiAuth.audience?.trim() || API_AUTH_AUDIENCE_ENV?.trim() || undefined
  const issuer = runtimeApiAuth.issuer?.trim() || API_AUTH_ISSUER_ENV?.trim() || undefined
  return { bearerToken, audience, issuer }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = resolveApiAuthContext()
  const authHeaders: Record<string, string> = {}
  if (auth.bearerToken) authHeaders.Authorization = `Bearer ${auth.bearerToken}`
  if (auth.audience) authHeaders['X-API-Audience'] = auth.audience
  if (auth.issuer) authHeaders['X-API-Issuer'] = auth.issuer
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    let code: string | undefined
    try {
      const body = (await res.json()) as { error?: string; code?: string }
      if (body?.error) {
        message = body.error
      }
      if (typeof body?.code === 'string' && body.code.trim()) {
        code = body.code.trim()
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError({ status: res.status, message, code })
  }

  if (res.status === 204) {
    // No content
    return undefined as T
  }

  return (await res.json()) as T
}

export async function register(payload: AuthPayload): Promise<AuthUser> {
  if (useLocalMobileDb()) {
    try {
      return await registerLocal(payload)
    } catch (e) {
      raiseFromLocalAuth(e)
    }
  }
  return request<AuthUser>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function login(payload: AuthPayload): Promise<AuthUser> {
  if (useLocalMobileDb()) {
    try {
      return await loginLocal(payload)
    } catch (e) {
      raiseFromLocalAuth(e)
    }
  }
  return request<AuthUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout(): Promise<void> {
  if (useLocalMobileDb()) {
    await logoutLocal()
    return
  }
  return request<void>('/api/auth/logout', { method: 'POST' })
}

export async function me(): Promise<AuthUser> {
  if (useLocalMobileDb()) {
    const u = await getLocalSessionUser()
    if (!u) {
      throw new ApiError({ status: 401, message: 'Not signed in', code: 'authentication_required' })
    }
    return u
  }
  return request<AuthUser>('/api/auth/me')
}

export async function recoverPassword(payload: RecoverPasswordPayload): Promise<RecoverPasswordResponse> {
  if (useLocalMobileDb()) {
    try {
      return await recoverPasswordLocal(payload)
    } catch (e) {
      raiseFromLocalAuth(e)
    }
  }
  return request<RecoverPasswordResponse>('/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function resetPassword(payload: ResetPasswordPayload): Promise<{ status: string }> {
  return request<{ status: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UsersSortField =
  | 'created_at'
  | 'updated_at'
  | 'email'
  | 'username'
  | 'display_name'
  | 'first_name'
  | 'last_name'
  | 'role'

export interface ListUsersParams {
  q?: string
  role?: UserRole
  sort?: UsersSortField
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface ListUsersResult {
  users: AuthUser[]
  total: number
}

export function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  const sp = new URLSearchParams()
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.role) sp.set('role', params.role)
  if (params.sort) sp.set('sort', params.sort)
  if (params.order) sp.set('order', params.order)
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit))
  if (typeof params.offset === 'number') sp.set('offset', String(params.offset))
  const qs = sp.toString()
  return request<ListUsersResult>(`/api/users${qs ? `?${qs}` : ''}`)
}

export interface UserDisplayNamesResult {
  displayNames: string[]
}

/** Editor+ on server; on native SQLite all signed-in mutating roles see local directory. */
export async function listUserDisplayNames(): Promise<UserDisplayNamesResult> {
  if (useLocalMobileDb()) {
    return listUserDisplayNamesLocal()
  }
  return request<UserDisplayNamesResult>('/api/users/display-names')
}

/** Disabled on the server; kept for rare tooling only. */
export function createUser(payload: AuthPayload & { role: UserRole }): Promise<AuthUser> {
  return request<AuthUser>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(id: string, payload: { email: string; username: string; firstName: string; lastName: string; role: UserRole }): Promise<AuthUser> {
  return request<AuthUser>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteUser(id: string): Promise<void> {
  return request<void>(`/api/users/${id}`, { method: 'DELETE' })
}

export interface AdminUserPasswordResetResult {
  status: string
  message?: string
  resetUrl?: string
  token?: string
}

export function requestUserPasswordReset(userId: string): Promise<AdminUserPasswordResetResult> {
  return request<AdminUserPasswordResetResult>(`/api/users/${userId}/request-password-reset`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function listAuditLogs(
  params: {
    userId?: string
    q?: string
    field?: string
    sort?: AuditLogsSortField
    order?: 'asc' | 'desc'
    limit?: number
  } = {},
): Promise<AuditLog[]> {
  const sp = new URLSearchParams()
  if (params.userId?.trim()) sp.set('userId', params.userId.trim())
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.field?.trim()) sp.set('field', params.field.trim())
  if (params.sort) sp.set('sort', params.sort)
  if (params.order) sp.set('order', params.order)
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit))
  return request<AuditLog[]>(`/api/audit-logs?${sp.toString()}`)
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
  if (params.q?.trim()) search.set('q', params.q.trim())
  if (params.status) search.set('status', params.status)
  if (params.priority) search.set('priority', params.priority)
  if (params.owner?.trim()) search.set('owner', params.owner.trim())
  if (params.tag?.trim()) search.set('tag', params.tag.trim())
  if (params.sort) search.set('sort', params.sort)
  if (params.order) search.set('order', params.order)
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

