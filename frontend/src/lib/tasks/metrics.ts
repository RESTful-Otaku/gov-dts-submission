import type { Task } from '../api'

export type DueStateFn = (task: Task) => string

export function taskDueCounts(
  tasks: Task[],
  dueState: DueStateFn,
): {
  overdueCount: number
  dueTodayCount: number
  dueThisWeekCount: number
} {
  let overdueCount = 0
  let dueTodayCount = 0
  let dueThisWeekCount = 0
  for (const t of tasks) {
    const d = dueState(t)
    if (d === 'overdue') overdueCount++
    else if (d === 'due-today') dueTodayCount++
    else if (d === 'due-soon') dueThisWeekCount++
  }
  return { overdueCount, dueTodayCount, dueThisWeekCount }
}

export function uniqueSortedTags(tasks: Task[]): string[] {
  return Array.from(new Set(tasks.flatMap((t) => t.tags ?? []).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

export function uniqueSortedOwners(tasks: Task[]): string[] {
  return Array.from(new Set(tasks.map((t) => (t.owner ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}
