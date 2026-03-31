import type { TaskPriority, TaskStatus } from '../api'

export type ViewMode = 'cards' | 'list' | 'kanban'
export type SortKey = 'due' | 'title' | 'priority'
export type Theme = 'light' | 'dark'
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type UiDensity = 'comfortable' | 'compact'
export type MotionPreference = 'system' | 'reduced' | 'full'
export type StartupViewMode = 'remember' | ViewMode
export type ToastType = 'error' | 'warning' | 'notification'

export type Toast = {
  id: number
  message: string
  type: ToastType
  /** Browser timers are numeric; Node uses `Timeout` — both work with `clearTimeout`. */
  timeoutId: ReturnType<typeof setTimeout> | number
  exiting?: boolean
}

export type StatusFilter = 'all' | TaskStatus
export type PriorityFilter = 'all' | TaskPriority
