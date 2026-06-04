import type { Task } from '../api'
import type { ListPageSize } from '../app/constants'
import type { PriorityFilter, SortKey, StatusFilter, ViewMode } from '../app/types'
import { createTaskFilterPredicate } from './filter'
import { getSortedTasks } from './sort'

/** Filtered + sorted tasks for the current UI state. */
export function buildVisibleTasks(
  tasks: Task[],
  debouncedSearchTerm: string,
  statusFilter: StatusFilter,
  priorityFilter: PriorityFilter,
  ownerFilter: string,
  tagFilters: string[],
  filterFrom: string,
  filterTo: string,
  sortKey: SortKey,
  sortAscending: boolean,
): Task[] {
  const predicate = createTaskFilterPredicate({
    qRaw: debouncedSearchTerm,
    status: statusFilter,
    priority: priorityFilter,
    ownerQ: ownerFilter,
    tagFilters,
    from: filterFrom,
    to: filterTo,
  })
  return getSortedTasks(
    tasks.filter((t) => predicate(t)),
    sortKey,
    sortAscending,
  )
}

/** Paginated slice for desktop list view; mobile list shows the full filtered set. */
export function computeListTasksDisplay(
  viewMode: ViewMode,
  isNarrow: boolean,
  visibleTasks: Task[],
  listPage: number,
  listPageSize: ListPageSize,
): Task[] {
  if (viewMode !== 'list') return []
  if (isNarrow) return visibleTasks
  return visibleTasks.slice((listPage - 1) * listPageSize, listPage * listPageSize)
}

export function computeTotalListPages(
  viewMode: ViewMode,
  isNarrow: boolean,
  visibleTasksLength: number,
  listPageSize: ListPageSize,
): number {
  if (viewMode === 'list' && !isNarrow) {
    return Math.max(1, Math.ceil(visibleTasksLength / listPageSize))
  }
  return 1
}

export function hasActiveFilters(
  statusFilter: StatusFilter,
  priorityFilter: PriorityFilter,
  ownerFilter: string,
  tagFilters: string[],
  filterFrom: string,
  filterTo: string,
): boolean {
  return (
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    !!ownerFilter.trim() ||
    tagFilters.length > 0 ||
    !!filterFrom ||
    !!filterTo
  )
}
