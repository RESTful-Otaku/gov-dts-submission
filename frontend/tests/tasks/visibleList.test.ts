import { describe, expect, it } from 'vitest'
import type { Task } from '../../src/lib/api'
import {
  buildVisibleTasks,
  computeListTasksDisplay,
  computeTotalListPages,
  hasActiveFilters,
} from '../../src/lib/tasks/visibleList'

const task = (id: string, title: string): Task => ({
  id,
  title,
  status: 'todo',
  dueAt: '2026-06-15T12:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('visibleList', () => {
  it('hasActiveFilters', () => {
    expect(hasActiveFilters('all', 'all', '', [], '', '')).toBe(false)
    expect(hasActiveFilters('todo', 'all', '', [], '', '')).toBe(true)
    expect(hasActiveFilters('all', 'all', '', ['evidence'], '', '')).toBe(true)
  })

  it('buildVisibleTasks filters and sorts', () => {
    const tasks = [task('1', 'zebra'), task('2', 'apple')]
    const visible = buildVisibleTasks(tasks, '', 'all', 'all', '', [], '', '', 'title', true)
    expect(visible.map((t) => t.title)).toEqual(['apple', 'zebra'])
  })

  it('computeListTasksDisplay and computeTotalListPages', () => {
    const tasks = [task('1', 'a'), task('2', 'b'), task('3', 'c')]
    expect(computeListTasksDisplay('cards', false, tasks, 1, 10)).toEqual([])
    expect(computeListTasksDisplay('list', true, tasks, 1, 10)).toEqual(tasks)
    expect(computeListTasksDisplay('list', false, tasks, 1, 2).map((t) => t.id)).toEqual(['1', '2'])
    expect(computeTotalListPages('list', false, 5, 2)).toBe(3)
    expect(computeTotalListPages('list', true, 5, 2)).toBe(1)
  })
})
