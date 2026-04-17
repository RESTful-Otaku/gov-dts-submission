import { toDisplayDate } from '../tasks/date'
import type {
  FontSize,
  MotionPreference,
  PriorityFilter,
  SortKey,
  StatusFilter,
  TaskSavedView,
  Theme,
  UiDensity,
  ViewMode,
  StartupViewMode,
} from './types'

export const TASK_UI_LS = {
  theme: 'task-theme',
  fontSize: 'task-font-size',
  viewMode: 'task-view-mode',
  sortKey: 'task-sort-key',
  sortAscending: 'task-sort-ascending',
  statusFilter: 'task-status-filter',
  priorityFilter: 'task-priority-filter',
  ownerFilter: 'task-owner-filter',
  tagFilter: 'task-tag-filter',
  searchTerm: 'task-search-term',
  filterFrom: 'task-filter-from',
  filterTo: 'task-filter-to',
  showFilters: 'task-show-filters',
  density: 'task-ui-density',
  motionPreference: 'task-motion-preference',
  startupViewMode: 'task-startup-view-mode',
  defaultSortKey: 'task-default-sort-key',
  defaultSortAscending: 'task-default-sort-ascending',
  savedViews: 'task-saved-views-v1',
} as const

export type TaskUiPersistedState = {
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

/** Persisted under `task-tag-filter`: JSON array, or legacy single tag string. */
export function parseStoredTagFilters(raw: string | null): string[] {
  if (raw == null || raw === '') return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed.map((s) => s.trim()).filter(Boolean)
      }
    } catch {
      /* legacy fallback below */
    }
  }
  return [trimmed]
}

export function stringifyTagFiltersForStorage(tags: string[]): string {
  return JSON.stringify(tags)
}

/** Maps OS light/dark preference to app theme (defaults to light when unknown). */
export function systemPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Apply theme to the document. When `persist` is false, localStorage is untouched — used for
 * “follow system until the user toggles” on mobile / native first visits.
 */
export function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.dataset.theme = theme
  if (persist) {
    localStorage.setItem(TASK_UI_LS.theme, theme)
  }
}

export function applyFontSize(fontSize: FontSize): void {
  const size =
    fontSize === 'xs'
      ? '14px'
      : fontSize === 'sm'
        ? '15px'
        : fontSize === 'md'
          ? '16px'
          : fontSize === 'lg'
            ? '18px'
            : fontSize === 'xl'
              ? '20px'
              : '22px'
  document.documentElement.style.fontSize = size
  localStorage.setItem(TASK_UI_LS.fontSize, fontSize)
}

export function applyDensity(density: UiDensity): void {
  document.documentElement.dataset.density = density
  localStorage.setItem(TASK_UI_LS.density, density)
}

export function applyMotionPreference(motionPreference: MotionPreference): void {
  if (motionPreference === 'system') {
    document.documentElement.removeAttribute('data-motion')
  } else {
    document.documentElement.dataset.motion = motionPreference
  }
  localStorage.setItem(TASK_UI_LS.motionPreference, motionPreference)
}

export function setStartupViewModePreference(startupViewMode: StartupViewMode): void {
  localStorage.setItem(TASK_UI_LS.startupViewMode, startupViewMode)
}

export function setDefaultSortPreference(sortKey: SortKey, sortAscending: boolean): void {
  localStorage.setItem(TASK_UI_LS.defaultSortKey, sortKey)
  localStorage.setItem(TASK_UI_LS.defaultSortAscending, String(sortAscending))
}

/**
 * Match production root appearance (`data-theme` + rem base) without touching localStorage.
 * Used by Storybook so the canvas uses the same CSS variables and scaling as the app.
 */
export function syncRootAppearance(theme: Theme, fontSize: FontSize): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.fontSize =
    fontSize === 'xs'
      ? '14px'
      : fontSize === 'sm'
        ? '15px'
        : fontSize === 'md'
          ? '16px'
          : fontSize === 'lg'
            ? '18px'
            : fontSize === 'xl'
              ? '20px'
              : '22px'
}

export function persistTaskUiPreferences(state: TaskUiPersistedState): void {
  localStorage.setItem(TASK_UI_LS.viewMode, state.viewMode)
  localStorage.setItem(TASK_UI_LS.sortKey, state.sortKey)
  localStorage.setItem(TASK_UI_LS.sortAscending, String(state.sortAscending))
  localStorage.setItem(TASK_UI_LS.statusFilter, state.statusFilter)
  localStorage.setItem(TASK_UI_LS.priorityFilter, state.priorityFilter)
  localStorage.setItem(TASK_UI_LS.ownerFilter, state.ownerFilter)
  localStorage.setItem(TASK_UI_LS.tagFilter, stringifyTagFiltersForStorage(state.tagFilters))
  localStorage.setItem(TASK_UI_LS.searchTerm, state.searchTerm)
  localStorage.setItem(TASK_UI_LS.filterFrom, state.filterFrom ?? '')
  localStorage.setItem(TASK_UI_LS.filterTo, state.filterTo ?? '')
  localStorage.setItem(TASK_UI_LS.showFilters, String(state.showFilters))
}

export type LoadedTaskUiBootstrap = {
  theme?: Theme
  fontSize?: FontSize
  viewMode?: ViewMode
  sortKey?: SortKey
  sortAscending?: boolean
  statusFilter?: StatusFilter
  priorityFilter?: PriorityFilter
  ownerFilter?: string
  tagFilters?: string[]
  searchTerm?: string
  debouncedSearchTerm?: string
  filterFrom?: string
  filterTo?: string
  showFilters?: boolean
  density?: UiDensity
  motionPreference?: MotionPreference
  startupViewMode?: StartupViewMode
  defaultSortKey?: SortKey
  defaultSortAscending?: boolean
}

/** Read saved UI state from localStorage (browser only). */
export function loadTaskUiBootstrapFromStorage(): LoadedTaskUiBootstrap {
  const out: LoadedTaskUiBootstrap = {}

  const storedTheme = localStorage.getItem(TASK_UI_LS.theme) as Theme | null
  if (storedTheme === 'light' || storedTheme === 'dark') {
    out.theme = storedTheme
  }

  const storedFont = localStorage.getItem(TASK_UI_LS.fontSize) as FontSize | 'normal' | 'large' | 'xlarge' | null
  if (
    storedFont === 'xs' ||
    storedFont === 'sm' ||
    storedFont === 'md' ||
    storedFont === 'lg' ||
    storedFont === 'xl' ||
    storedFont === 'xxl'
  ) {
    out.fontSize = storedFont
  } else if (storedFont === 'normal') {
    out.fontSize = 'md'
  } else if (storedFont === 'large') {
    out.fontSize = 'lg'
  } else if (storedFont === 'xlarge') {
    out.fontSize = 'xl'
  }

  const storedView = localStorage.getItem(TASK_UI_LS.viewMode) as ViewMode | null
  if (storedView === 'cards' || storedView === 'list' || storedView === 'kanban') {
    out.viewMode = storedView
  }

  const storedSortKey = localStorage.getItem(TASK_UI_LS.sortKey) as SortKey | null
  if (
    storedSortKey === 'due' ||
    storedSortKey === 'title' ||
    storedSortKey === 'priority' ||
    storedSortKey === 'owner' ||
    storedSortKey === 'status' ||
    storedSortKey === 'tags' ||
    storedSortKey === 'created'
  ) {
    out.sortKey = storedSortKey
  }

  const storedSortAsc = localStorage.getItem(TASK_UI_LS.sortAscending)
  if (storedSortAsc === 'true' || storedSortAsc === 'false') {
    out.sortAscending = storedSortAsc === 'true'
  }

  const storedStatusFilter = localStorage.getItem(TASK_UI_LS.statusFilter) as StatusFilter | null
  if (
    storedStatusFilter === 'all' ||
    storedStatusFilter === 'todo' ||
    storedStatusFilter === 'in_progress' ||
    storedStatusFilter === 'done'
  ) {
    out.statusFilter = storedStatusFilter
  }

  const storedPriorityFilter = localStorage.getItem(
    TASK_UI_LS.priorityFilter,
  ) as PriorityFilter | null
  if (
    storedPriorityFilter === 'all' ||
    storedPriorityFilter === 'low' ||
    storedPriorityFilter === 'normal' ||
    storedPriorityFilter === 'high' ||
    storedPriorityFilter === 'urgent'
  ) {
    out.priorityFilter = storedPriorityFilter
  }

  const storedOwnerFilter = localStorage.getItem(TASK_UI_LS.ownerFilter)
  if (typeof storedOwnerFilter === 'string') out.ownerFilter = storedOwnerFilter

  const storedTagFilter = localStorage.getItem(TASK_UI_LS.tagFilter)
  if (typeof storedTagFilter === 'string') {
    out.tagFilters = parseStoredTagFilters(storedTagFilter)
  }

  const storedSearch = localStorage.getItem(TASK_UI_LS.searchTerm)
  if (typeof storedSearch === 'string') {
    out.searchTerm = storedSearch
    out.debouncedSearchTerm = storedSearch
  }

  const storedFrom = localStorage.getItem(TASK_UI_LS.filterFrom)
  if (typeof storedFrom === 'string') {
    out.filterFrom = toDisplayDate(storedFrom) || storedFrom
  }

  const storedTo = localStorage.getItem(TASK_UI_LS.filterTo)
  if (typeof storedTo === 'string') {
    out.filterTo = toDisplayDate(storedTo) || storedTo
  }

  const storedShowFilters = localStorage.getItem(TASK_UI_LS.showFilters)
  if (storedShowFilters === 'true' || storedShowFilters === 'false') {
    out.showFilters = storedShowFilters === 'true'
  }

  const storedDensity = localStorage.getItem(TASK_UI_LS.density) as UiDensity | null
  if (storedDensity === 'comfortable' || storedDensity === 'compact') {
    out.density = storedDensity
  }

  const storedMotion = localStorage.getItem(TASK_UI_LS.motionPreference) as MotionPreference | null
  if (storedMotion === 'system' || storedMotion === 'reduced' || storedMotion === 'full') {
    out.motionPreference = storedMotion
  }

  const storedStartupView = localStorage.getItem(TASK_UI_LS.startupViewMode) as StartupViewMode | null
  if (
    storedStartupView === 'remember' ||
    storedStartupView === 'cards' ||
    storedStartupView === 'list' ||
    storedStartupView === 'kanban'
  ) {
    out.startupViewMode = storedStartupView
  }

  const storedDefaultSortKey = localStorage.getItem(TASK_UI_LS.defaultSortKey) as SortKey | null
  if (
    storedDefaultSortKey === 'due' ||
    storedDefaultSortKey === 'title' ||
    storedDefaultSortKey === 'priority' ||
    storedDefaultSortKey === 'owner' ||
    storedDefaultSortKey === 'status' ||
    storedDefaultSortKey === 'tags' ||
    storedDefaultSortKey === 'created'
  ) {
    out.defaultSortKey = storedDefaultSortKey
  }

  const storedDefaultSortAsc = localStorage.getItem(TASK_UI_LS.defaultSortAscending)
  if (storedDefaultSortAsc === 'true' || storedDefaultSortAsc === 'false') {
    out.defaultSortAscending = storedDefaultSortAsc === 'true'
  }

  return out
}

function isTaskSavedView(value: unknown): value is TaskSavedView {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TaskSavedView>
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return false
  const state = candidate.state as TaskSavedView['state'] | undefined
  if (!state) return false
  if (!['cards', 'list', 'kanban'].includes(state.viewMode)) return false
  if (
    !['due', 'title', 'priority', 'owner', 'status', 'tags', 'created'].includes(state.sortKey)
  )
    return false
  if (typeof state.sortAscending !== 'boolean') return false
  if (!['all', 'todo', 'in_progress', 'done'].includes(state.statusFilter)) return false
  if (!['all', 'low', 'normal', 'high', 'urgent'].includes(state.priorityFilter)) return false
  if (typeof state.ownerFilter !== 'string') return false
  if (!Array.isArray(state.tagFilters) || !state.tagFilters.every((x) => typeof x === 'string')) return false
  if (typeof state.searchTerm !== 'string') return false
  if (typeof state.filterFrom !== 'string' || typeof state.filterTo !== 'string') return false
  if (typeof state.showFilters !== 'boolean') return false
  return true
}

export function loadSavedViewsFromStorage(): TaskSavedView[] {
  const raw = localStorage.getItem(TASK_UI_LS.savedViews)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is TaskSavedView => isTaskSavedView(v))
  } catch {
    return []
  }
}

export function persistSavedViewsToStorage(savedViews: TaskSavedView[]): void {
  localStorage.setItem(TASK_UI_LS.savedViews, JSON.stringify(savedViews))
}
