import { describe, expect, it } from 'vitest'

import type { Task } from '../../src/lib/api'
import { getSortedTasks } from '../../src/lib/tasks/sort'

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    status: partial.status ?? 'todo',
    dueAt: partial.dueAt ?? new Date().toISOString(),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
    priority: partial.priority,
    owner: partial.owner,
    description: partial.description,
    tags: partial.tags,
  }
}

describe('getSortedTasks', () => {
  it('sorts by title case-insensitively', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'banana' }),
      makeTask({ id: 'b', title: 'Apple' }),
      makeTask({ id: 'c', title: 'cherry' }),
    ]

    const asc = getSortedTasks(tasks, 'title', true)
    expect(asc.map((t) => t.id)).toEqual(['b', 'a', 'c'])

    const desc = getSortedTasks(tasks, 'title', false)
    expect(desc.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts by priority using PRIORITY_ORDER', () => {
    const tasks: Task[] = [
      makeTask({ id: 'low', title: 't', priority: 'low' }),
      makeTask({ id: 'normal', title: 't', priority: 'normal' }),
      makeTask({ id: 'high', title: 't', priority: 'high' }),
      makeTask({ id: 'urgent', title: 't', priority: 'urgent' }),
      // undefined priority treated as 'normal'
      makeTask({ id: 'undef', title: 't' }),
    ]

    const asc = getSortedTasks(tasks, 'priority', true)
    expect(asc.map((t) => t.id)).toEqual(['low', 'normal', 'undef', 'high', 'urgent'])

    const desc = getSortedTasks(tasks, 'priority', false)
    expect(desc.map((t) => t.id)[0]).toBe('urgent')
    expect(desc.map((t) => t.id)[desc.map((t) => t.id).length - 1]).toBe('low')
  })

  it('sorts by dueAt ISO time', () => {
    const t1 = new Date(2026, 0, 1, 10, 0, 0, 0).toISOString()
    const t2 = new Date(2026, 0, 1, 11, 0, 0, 0).toISOString()
    const tasks: Task[] = [
      makeTask({ id: 'later', dueAt: t2 }),
      makeTask({ id: 'earlier', dueAt: t1 }),
    ]

    const asc = getSortedTasks(tasks, 'due', true)
    expect(asc.map((t) => t.id)).toEqual(['earlier', 'later'])
  })
})

