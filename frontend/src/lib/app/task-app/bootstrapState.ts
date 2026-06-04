import type { LoadedTaskUiBootstrap, TaskUiPersistedState } from '../preferences'
import type {
  FontSize,
  MotionPreference,
  PriorityFilter,
  SortKey,
  StartupViewMode,
  StatusFilter,
  Theme,
  UiDensity,
  ViewMode,
} from '../types'

export type TaskAppBootstrapDefaults = {
  theme: Theme
  fontSize: FontSize
  viewMode: ViewMode
  sortKey: SortKey
  sortAscending: boolean
  statusFilter: StatusFilter
  priorityFilter: PriorityFilter
  ownerFilter: string
  tagFilters: string[]
  searchTerm: string
  debouncedSearchTerm: string
  filterFrom: string
  filterTo: string
  showFilters: boolean
  density: UiDensity
  motionPreference: MotionPreference
  startupViewMode: StartupViewMode
  defaultSortKey: SortKey
  defaultSortAscending: boolean
}

export function resolveBootstrapState(input: {
  boot: LoadedTaskUiBootstrap
  defaults: TaskAppBootstrapDefaults
  isNarrow: boolean
  isNativePlatform: boolean
  systemTheme: () => Theme
}): TaskAppBootstrapDefaults {
  const { boot, defaults, isNarrow, isNativePlatform, systemTheme } = input

  const theme = boot.theme ?? (isNarrow || isNativePlatform ? systemTheme() : 'light')
  const fontSize = boot.fontSize ?? defaults.fontSize
  const density = boot.density ?? defaults.density
  const motionPreference = boot.motionPreference ?? defaults.motionPreference
  const startupViewMode = boot.startupViewMode ?? defaults.startupViewMode
  const defaultSortKey = boot.defaultSortKey ?? defaults.defaultSortKey
  const defaultSortAscending = boot.defaultSortAscending ?? defaults.defaultSortAscending

  let viewMode = boot.viewMode ?? defaults.viewMode
  if (startupViewMode !== 'remember') {
    viewMode = startupViewMode
  }

  const sortKey = boot.sortKey ?? defaultSortKey
  const sortAscending = boot.sortAscending ?? defaultSortAscending

  return {
    theme,
    fontSize,
    viewMode,
    sortKey,
    sortAscending,
    statusFilter: boot.statusFilter ?? defaults.statusFilter,
    priorityFilter: boot.priorityFilter ?? defaults.priorityFilter,
    ownerFilter: boot.ownerFilter ?? defaults.ownerFilter,
    tagFilters: boot.tagFilters ? [...boot.tagFilters] : defaults.tagFilters,
    searchTerm: boot.searchTerm ?? defaults.searchTerm,
    debouncedSearchTerm: boot.debouncedSearchTerm ?? defaults.debouncedSearchTerm,
    filterFrom: boot.filterFrom ?? defaults.filterFrom,
    filterTo: boot.filterTo ?? defaults.filterTo,
    showFilters: boot.showFilters ?? defaults.showFilters,
    density,
    motionPreference,
    startupViewMode,
    defaultSortKey,
    defaultSortAscending,
  }
}

export function toPersistedTaskUiState(state: TaskUiPersistedState): TaskUiPersistedState {
  return {
    viewMode: state.viewMode,
    sortKey: state.sortKey,
    sortAscending: state.sortAscending,
    statusFilter: state.statusFilter,
    priorityFilter: state.priorityFilter,
    ownerFilter: state.ownerFilter,
    tagFilters: [...state.tagFilters],
    searchTerm: state.searchTerm,
    filterFrom: state.filterFrom,
    filterTo: state.filterTo,
    showFilters: state.showFilters,
  }
}
