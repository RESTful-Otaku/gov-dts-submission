import type { Task } from '../api'

/** Returns 'overdue' | 'due-today' | 'due-soon' | '' for styling. */
export function dueState(task: Task): string {
  const due = new Date(task.dueAt)
  if (Number.isNaN(due.getTime())) return ''

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const weekEnd = new Date(todayStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  if (due < now) return 'overdue'
  if (due >= todayStart && due < todayEnd) return 'due-today'
  if (due >= todayEnd && due < weekEnd) return 'due-soon'
  return ''
}

