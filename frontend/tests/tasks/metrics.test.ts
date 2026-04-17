import { describe, expect, it } from 'vitest'
import type { Task } from '../../src/lib/api'
import { taskDueCounts, uniqueSortedOwners, uniqueSortedTags } from '../../src/lib/tasks/metrics'

const base = (over: Partial<Task>): Task => ({
  id: '1',
  title: 't',
  status: 'todo',
  dueAt: '2026-06-01T12:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('task metrics', () => {
  it('taskDueCounts aggregates by dueState', () => {
    const dueState = (t: Task) => t.id
    const tasks = [base({ id: 'overdue' }), base({ id: 'due-today' }), base({ id: 'due-soon' })]
    expect(taskDueCounts(tasks, dueState)).toEqual({
      overdueCount: 1,
      dueTodayCount: 1,
      dueThisWeekCount: 1,
    })
  })

  it('uniqueSortedTags and uniqueSortedOwners', () => {
    const tasks = [
      base({ id: 'a', tags: ['z', 'a'], owner: '  Bob  ' }),
      base({ id: 'b', tags: ['a'], owner: 'Ann' }),
    ]
    expect(uniqueSortedTags(tasks)).toEqual(['a', 'z'])
    expect(uniqueSortedOwners(tasks)).toEqual(['Ann', 'Bob'])
  })
})
