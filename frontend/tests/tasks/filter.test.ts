import { describe, expect, it } from 'vitest'

import type { Task, TaskPriority, TaskStatus } from '../../src/lib/api'
import { matchesFilters } from '../../src/lib/tasks/filter'

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? 'Task',
    description: partial.description ?? null,
    status: (partial.status ?? 'todo') as TaskStatus,
    priority: partial.priority as TaskPriority | undefined,
    owner: partial.owner ?? '',
    tags: partial.tags ?? [],
    dueAt: partial.dueAt ?? new Date().toISOString(),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  }
}

describe('matchesFilters', () => {
  it('matches free-text search across title/description/status/priority/owner/tags/date', () => {
    const dueAt = new Date(2026, 2, 27, 10, 0, 0, 0).toISOString()
    const task = makeTask({
      id: 't1',
      title: 'Review evidence',
      description: 'Caseworker notes',
      status: 'todo',
      priority: 'high',
      owner: 'Sarah Chen',
      tags: ['evidence', 'hearing'],
      dueAt,
    })

    expect(matchesFilters(task, 'review evidence', 'all', 'all', '', [], '', '')).toBe(true)
    expect(matchesFilters(task, 'high sarah', 'all', 'all', '', [], '', '')).toBe(true)
    expect(matchesFilters(task, 'nomatch', 'all', 'all', '', [], '', '')).toBe(false)
  })

  it('filters by status and priority', () => {
    const task = makeTask({ id: 't1', status: 'todo', priority: 'high' })
    expect(matchesFilters(task, '', 'done', 'all', '', [], '', '')).toBe(false)
    expect(matchesFilters(task, '', 'all', 'low', '', [], '', '')).toBe(false)
    expect(matchesFilters(task, '', 'todo', 'high', '', [], '', '')).toBe(true)
  })

  it('filters by owner and tag substring', () => {
    const task = makeTask({
      id: 't1',
      owner: 'Sarah Chen',
      tags: ['evidence', 'hearing'],
    })

    expect(matchesFilters(task, '', 'all', 'all', 'chen', [], '', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', ['evi'], '', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', ['nope'], '', '')).toBe(false)
  })

  it('requires every selected tag criterion (AND) on task tags', () => {
    const task = makeTask({
      id: 't1',
      tags: ['evidence', 'hearing'],
    })
    expect(matchesFilters(task, '', 'all', 'all', '', ['evidence'], '', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', ['evidence', 'hearing'], '', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', ['evidence', 'missing'], '', '')).toBe(false)
  })

  it('filters by from/to inclusive date range (UK DD-MM-YYYY)', () => {
    const dueAt = new Date(2026, 2, 27, 10, 0, 0, 0).toISOString()
    const task = makeTask({ id: 't1', dueAt })

    expect(matchesFilters(task, '', 'all', 'all', '', [], '26-03-2026', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', [], '28-03-2026', '')).toBe(false)

    expect(matchesFilters(task, '', 'all', 'all', '', [], '', '27-03-2026')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', [], '', '26-03-2026')).toBe(false)
  })

  it('filters by from/to when boundaries use ordinal UK dates', () => {
    const dueAt = new Date(2026, 2, 27, 10, 0, 0, 0).toISOString()
    const task = makeTask({ id: 't1', dueAt })

    expect(matchesFilters(task, '', 'all', 'all', '', [], '26th Mar 2026', '')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', [], '', '27th March 2026')).toBe(true)
    expect(matchesFilters(task, '', 'all', 'all', '', [], '', '26th Mar 2026')).toBe(false)
  })
})

