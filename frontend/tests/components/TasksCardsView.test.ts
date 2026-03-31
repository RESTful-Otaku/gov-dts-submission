import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import type { Task } from '../../src/lib/api'
import TasksCardsView from '../../src/components/tasks/TasksCardsView.svelte'

describe('TasksCardsView', () => {
  it('renders tasks grid and task cards', async () => {
    const user = userEvent.setup()
    const openEditModal = vi.fn()
    const handleDeleteTask = vi.fn()
    const filterByTag = vi.fn()

    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Review case bundle',
        description: 'Some context',
        status: 'todo',
        priority: 'high',
        owner: 'Sarah Chen',
        tags: ['evidence'],
        dueAt: new Date(2026, 2, 27, 10, 0, 0, 0).toISOString(),
        createdAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
        updatedAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
      },
    ]

    const { getByText, getByRole } = render(TasksCardsView, {
      props: {
        isNarrow: false,
        visibleTasks: tasks,
        priorityLabel: (p) => p,
        statusLabel: (s) => s,
        formatDate: (v) => v,
        openEditModal,
        handleDeleteTask,
        filterByTag,
      },
    })

    expect(getByText('Review case bundle')).toBeVisible()
    expect(getByRole('button', { name: 'Edit' })).toBeVisible()
    expect(getByRole('button', { name: 'Delete' })).toBeVisible()

    await user.click(getByRole('button', { name: 'Edit' }))
    expect(openEditModal).toHaveBeenCalledWith(tasks[0])

    await user.click(getByRole('button', { name: 'Delete' }))
    expect(handleDeleteTask).toHaveBeenCalledWith('t1')

    await user.click(getByText('evidence'))
    expect(filterByTag).toHaveBeenCalledWith('evidence')
  })

  it('renders empty message for empty task list', () => {
    const { getByText } = render(TasksCardsView, {
      props: {
        isNarrow: false,
        visibleTasks: [],
        priorityLabel: (p) => p,
        statusLabel: (s) => s,
        formatDate: (v) => v,
        openEditModal: vi.fn(),
        handleDeleteTask: vi.fn(),
        filterByTag: vi.fn(),
      },
    })

    expect(getByText('No tasks match your current search or filters.')).toBeVisible()
  })
})

