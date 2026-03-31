import type { Task, TaskPriority } from '../api'
import { PRIORITY_ORDER } from './taskMeta'

export type SortKey = 'due' | 'title' | 'priority'

export function getSortedTasks(source: Task[], key: SortKey, ascending: boolean): Task[] {
  const copy = [...source]
  copy.sort((a, b) => {
    if (key === 'title') {
      const at = a.title.toLocaleLowerCase()
      const bt = b.title.toLocaleLowerCase()
      if (at < bt) return ascending ? -1 : 1
      if (at > bt) return ascending ? 1 : -1
      return 0
    }
    if (key === 'priority') {
      const ap = PRIORITY_ORDER[(a.priority as TaskPriority) ?? 'normal']
      const bp = PRIORITY_ORDER[(b.priority as TaskPriority) ?? 'normal']
      if (ap < bp) return ascending ? -1 : 1
      if (ap > bp) return ascending ? 1 : -1
      return 0
    }

    // sort by due date
    const ad = new Date(a.dueAt).getTime()
    const bd = new Date(b.dueAt).getTime()
    if (ad < bd) return ascending ? -1 : 1
    if (ad > bd) return ascending ? 1 : -1
    return 0
  })
  return copy
}

