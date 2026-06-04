import type { TaskPriority, TaskStatus } from '../api'

export const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
] as const satisfies ReadonlyArray<{ value: TaskStatus; label: string }>

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const satisfies ReadonlyArray<{ value: TaskPriority; label: string }>

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

export function statusLabel(s: TaskStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s
}

export function priorityLabel(p: TaskPriority): string {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p ?? 'Normal'
}

