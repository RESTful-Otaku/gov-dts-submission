import { describe, expect, it } from 'vitest'

import type { Task } from '../../src/lib/api'
import { mergeColumnIntoTasks, tasksForColumn } from '../../src/lib/tasks/kanban'

function makeTask(partial: Partial<Task> & { id: string; status: Task['status'] }): Task {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    description: partial.description ?? null,
    status: partial.status,
    priority: partial.priority,
    owner: partial.owner ?? '',
    tags: partial.tags ?? [],
    dueAt: partial.dueAt ?? new Date().toISOString(),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  }
}

describe('kanban helpers', () => {
  it('tasksForColumn filters by status', () => {
    const items: Task[] = [
      makeTask({ id: 'a', status: 'todo' }),
      makeTask({ id: 'b', status: 'done' }),
      makeTask({ id: 'c', status: 'todo' }),
    ]

    expect(tasksForColumn(items, 'todo').map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('mergeColumnIntoTasks replaces the target column and moves items across columns', () => {
    const allTasks: Task[] = [
      makeTask({ id: 'a', status: 'todo' }),
      makeTask({ id: 'b', status: 'todo' }),
      makeTask({ id: 'c', status: 'done' }),
      makeTask({ id: 'd', status: 'in_progress' }),
    ]

    const items = [
      // b is already in the target column; c is moved from done -> todo.
      makeTask({ id: 'b', status: 'todo', title: 'B' }),
      makeTask({ id: 'c', status: 'done', title: 'C' }),
    ]

    const merged = mergeColumnIntoTasks(allTasks, 'todo', items)
    // Original todo tasks not in `items` are removed (a).
    // Tasks not in target status are kept unless their id is in `items` (d kept, c removed then re-added as todo).
    expect(merged.map((t) => t.id)).toEqual(['d', 'b', 'c'])
    expect(merged.find((t) => t.id === 'd')!.status).toBe('in_progress')
    expect(merged.find((t) => t.id === 'b')!.status).toBe('todo')
    expect(merged.find((t) => t.id === 'c')!.status).toBe('todo')
  })
})

