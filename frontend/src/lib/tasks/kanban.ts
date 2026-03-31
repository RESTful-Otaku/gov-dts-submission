import type { Task, TaskStatus } from '../api'

/** Tasks for a given column status. Used by dndzone. */
export function tasksForColumn(items: Task[], status: TaskStatus): Task[] {
  return items.filter((t) => t.status === status)
}

/**
 * Merge a column's items into the full task list.
 * This replaces the target column with `items` and moves any matching ids across columns.
 */
export function mergeColumnIntoTasks(allTasks: Task[], status: TaskStatus, items: Task[]): Task[] {
  return allTasks
    .filter((t) => t.status !== status && !items.some((n) => n.id === t.id))
    .concat(items.map((t) => ({ ...t, status })))
}

