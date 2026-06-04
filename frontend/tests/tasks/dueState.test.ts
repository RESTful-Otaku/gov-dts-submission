import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Task } from '../../src/lib/api'
import { dueState } from '../../src/lib/tasks/dueState'

function makeTask(partial: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Task',
    status: 'todo',
    dueAt: partial.dueAt ?? new Date().toISOString(),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
    priority: partial.priority,
    owner: partial.owner,
    description: partial.description,
    tags: partial.tags,
  }
}

describe('dueState', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies overdue / due-today / due-soon correctly relative to now', () => {
    vi.useFakeTimers()
    const now = new Date(2026, 2, 26, 10, 0, 0, 0) // 26-03-2026 10:00
    vi.setSystemTime(now)

    const overdue: Task = makeTask({
      dueAt: new Date(2026, 2, 26, 9, 30, 0, 0).toISOString(),
    })
    expect(dueState(overdue)).toBe('overdue')

    const today: Task = makeTask({
      dueAt: new Date(2026, 2, 26, 12, 0, 0, 0).toISOString(),
    })
    expect(dueState(today)).toBe('due-today')

    const soon: Task = makeTask({
      dueAt: new Date(2026, 2, 27, 10, 0, 0, 0).toISOString(),
    })
    expect(dueState(soon)).toBe('due-soon')

    const afterWeek: Task = makeTask({
      // weekEnd is todayStart + 7 days; due exactly on that day should not be due-soon
      dueAt: new Date(2026, 3, 2, 0, 0, 0, 0).toISOString(), // 02-04-2026 00:00 local
    })
    expect(dueState(afterWeek)).toBe('')

  })

  it('returns empty string for invalid dueAt', () => {
    const bad = makeTask({ dueAt: 'not-a-date' })
    expect(dueState(bad)).toBe('')
  })
})

