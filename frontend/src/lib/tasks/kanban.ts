import type { Task, TaskStatus } from '../api'
import { assertInvariant } from '../app/invariant'

/** Tasks for a given column status. Used by dndzone. */
export function tasksForColumn(items: Task[], status: TaskStatus): Task[] {
  return items.filter((t) => t.status === status)
}

/**
 * Merge a column's items into the full task list.
 * This replaces the target column with `items` and moves any matching ids across columns.
 */
export function mergeColumnIntoTasks(allTasks: Task[], status: TaskStatus, items: Task[]): Task[] {
  const uniqueIds = new Set(items.map((n) => n.id))
  if (!assertInvariant(uniqueIds.size === items.length, 'kanban merge received duplicate task ids')) {
    return allTasks
  }
  const movedIds = new Set(items.map((n) => n.id))
  return allTasks
    .filter((t) => t.status !== status && !movedIds.has(t.id))
    .concat(items.map((t) => ({ ...t, status })))
}

