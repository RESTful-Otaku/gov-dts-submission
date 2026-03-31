import type { Task, TaskPriority, TaskStatus } from '../api'
import { formatDate, parseUKDate } from './date'
import { priorityLabel, statusLabel } from './taskMeta'

export type StatusFilter = 'all' | TaskStatus
export type PriorityFilter = 'all' | TaskPriority

function taskMatchesTagCriterion(taskTags: string[], wantRaw: string): boolean {
  const want = wantRaw.trim().toLocaleLowerCase()
  if (!want) return true
  return taskTags.some(
    (t) => t.toLocaleLowerCase() === want || t.toLocaleLowerCase().includes(want),
  )
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
  const q = qRaw.trim().toLocaleLowerCase()

  if (q) {
    const parts = q.split(/\s+/).filter(Boolean)
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

  if (status !== 'all' && taskItem.status !== status) {
    return false
  }

  if (priority !== 'all' && (taskItem.priority ?? 'normal') !== priority) {
    return false
  }

  if (ownerQ.trim()) {
    const o = (taskItem.owner ?? '').trim().toLocaleLowerCase()
    if (!o.includes(ownerQ.trim().toLocaleLowerCase())) return false
  }

  if (tagFilters.length > 0) {
    const taskTags = taskItem.tags ?? []
    for (const criterion of tagFilters) {
      if (!taskMatchesTagCriterion(taskTags, criterion)) return false
    }
  }

  const fromStr = from ?? ''
  const toStr = to ?? ''

  if (fromStr || toStr) {
    const due = new Date(taskItem.dueAt)
    if (Number.isNaN(due.getTime())) {
      return false
    }

    if (fromStr) {
      const fromDateObj = parseUKDate(fromStr)
      if (!fromDateObj) return false
      const fromDate = new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), fromDateObj.getDate())
      if (due < fromDate) return false
    }

    if (toStr) {
      const toDateObj = parseUKDate(toStr)
      if (!toDateObj) return false
      const toDate = new Date(toDateObj.getFullYear(), toDateObj.getMonth(), toDateObj.getDate(), 23, 59, 59, 999)
      if (due > toDate) return false
    }
  }

  return true
}

