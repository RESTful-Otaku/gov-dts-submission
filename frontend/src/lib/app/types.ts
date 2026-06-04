import type { TaskPriority, TaskStatus } from '../api'

export type ViewMode = 'cards' | 'list' | 'kanban'
export type SortKey = 'due' | 'title' | 'priority' | 'owner' | 'status' | 'tags' | 'created'
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
  actionLabel?: string
  onAction?: () => void
  countdownSeconds?: number
  /** Browser timers are numeric; Node uses `Timeout` — both work with `clearTimeout`. */
  timeoutId: ReturnType<typeof setTimeout> | number
  countdownIntervalId?: ReturnType<typeof setInterval> | number
  exiting?: boolean
}

export type StatusFilter = 'all' | TaskStatus
export type PriorityFilter = 'all' | TaskPriority

export type TaskSavedView = {
  id: string
  name: string
  state: {
    viewMode: ViewMode
    sortKey: SortKey
    sortAscending: boolean
    statusFilter: StatusFilter
    priorityFilter: PriorityFilter
    ownerFilter: string
    tagFilters: string[]
    searchTerm: string
    filterFrom: string
    filterTo: string
    showFilters: boolean
  }
}

export type ActiveFilterChipKind =
  | 'search'
  | 'status'
  | 'priority'
  | 'owner'
  | 'tag'
  | 'from'
  | 'to'
  | 'sort'

export type ActiveFilterChip = {
  id: string
  kind: ActiveFilterChipKind
  label: string
}
