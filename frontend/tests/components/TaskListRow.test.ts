import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/svelte'

import type { Task } from '../../src/lib/api'
import TaskListRow from '../../src/components/tasks/TaskListRow.svelte'

describe('TaskListRow', () => {
  it('renders row cells', () => {
    const task: Task = {
      id: 't1',
      title: 'Test',
      description: null,
      status: 'todo',
      priority: 'high',
      owner: 'A',
      tags: [],
      dueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const { getByText } = render(TaskListRow, {
      props: {
        taskItem: task,
        selected: false,
        toggleTaskSelection: vi.fn(),
        openEditModal: vi.fn(),
        handleDeleteTask: vi.fn(),
        filterByTag: vi.fn(),
        priorityLabel: (p) => p,
        statusLabel: (s) => s,
        formatDate: (v) => v,
      },
    })
    expect(getByText('Test')).toBeVisible()
  })
})
