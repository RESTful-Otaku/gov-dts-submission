import type { Task, TaskPriority, TaskStatus } from '../api'
import { formatDate, parseUKDate } from './date'
import { priorityLabel, statusLabel } from './taskMeta'

export type StatusFilter = 'all' | TaskStatus
export type PriorityFilter = 'all' | TaskPriority
export interface FilterCriteria {
  qRaw: string
  status: StatusFilter
  priority: PriorityFilter
  ownerQ: string
  tagFilters: string[]
  from: string
  to: string
}

function taskMatchesTagCriterion(taskTags: string[], wantRaw: string): boolean {
  const want = wantRaw.trim().toLocaleLowerCase()
  if (!want) return true
  return taskTags.some(
    (t) => t.toLocaleLowerCase() === want || t.toLocaleLowerCase().includes(want),
  )
}

export function createTaskFilterPredicate(criteria: FilterCriteria): (taskItem: Task) => boolean {
  const q = criteria.qRaw.trim().toLocaleLowerCase()
  const parts = q ? q.split(/\s+/).filter(Boolean) : []
  const ownerNorm = criteria.ownerQ.trim().toLocaleLowerCase()
  const fromDateObj = criteria.from ? parseUKDate(criteria.from) : null
  const toDateObj = criteria.to ? parseUKDate(criteria.to) : null
  const fromDate = fromDateObj
    ? new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), fromDateObj.getDate())
    : null
  const toDate = toDateObj
    ? new Date(toDateObj.getFullYear(), toDateObj.getMonth(), toDateObj.getDate(), 23, 59, 59, 999)
    : null

  return (taskItem: Task): boolean => {
    if (parts.length > 0) {
      const taskPriority = taskItem.priority ?? 'normal'
      const haystack = [
        taskItem.title,
        taskItem.description ?? '',
        statusLabel(taskItem.status),
        priorityLabel(taskPriority),
        taskItem.owner ?? '',
        (taskItem.tags ?? []).join(' '),
        formatDate(taskItem.dueAt),
      ]
        .join(' ')
        .toLocaleLowerCase()

      for (const part of parts) {
        if (!haystack.includes(part)) return false
      }
    }

    if (criteria.status !== 'all' && taskItem.status !== criteria.status) {
      return false
    }

    if (criteria.priority !== 'all' && (taskItem.priority ?? 'normal') !== criteria.priority) {
      return false
    }

    if (ownerNorm) {
      const o = (taskItem.owner ?? '').trim().toLocaleLowerCase()
      if (!o.includes(ownerNorm)) return false
    }

    if (criteria.tagFilters.length > 0) {
      const taskTags = taskItem.tags ?? []
      for (const criterion of criteria.tagFilters) {
        if (!taskMatchesTagCriterion(taskTags, criterion)) return false
      }
    }

    if (fromDate || toDate) {
      const due = new Date(taskItem.dueAt)
      if (Number.isNaN(due.getTime())) {
        return false
      }

      if (fromDate && due < fromDate) return false
      if (toDate && due > toDate) return false
    }

    return true
  }
}

export function matchesFilters(
  taskItem: Task,
  qRaw: string,
  status: StatusFilter,
  priority: PriorityFilter,
  ownerQ: string,
  tagFilters: string[],
  from: string,
  to: string,
): boolean {
  return createTaskFilterPredicate({ qRaw, status, priority, ownerQ, tagFilters, from, to })(taskItem)
}

