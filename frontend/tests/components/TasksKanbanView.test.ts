import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import type { Task } from '../../src/lib/api'
import TasksKanbanView from '../../src/components/tasks/TasksKanbanView.svelte'

describe('TasksKanbanView', () => {
  it('renders kanban columns and task cards', async () => {
    const user = userEvent.setup()
    const openEditModal = vi.fn()
    const handleDeleteTask = vi.fn()
    const filterByTag = vi.fn()
    const handleKanbanConsider = vi.fn()
    const handleKanbanFinalize = vi.fn()

    const visibleTasks: Task[] = [
      {
        id: 't1',
        title: 'Review case bundle',
        description: null,
        status: 'todo',
        priority: 'normal',
        owner: '',
        tags: ['evidence'],
        dueAt: new Date(2026, 2, 27, 10, 0, 0, 0).toISOString(),
        createdAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
        updatedAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
      },
      {
        id: 't2',
        title: 'Prepare hearing notes',
        description: 'Notes',
        status: 'done',
        priority: 'high',
        owner: 'James Wilson',
        tags: [],
        dueAt: new Date(2026, 2, 28, 10, 0, 0, 0).toISOString(),
        createdAt: new Date(2026, 2, 2, 10, 0, 0, 0).toISOString(),
        updatedAt: new Date(2026, 2, 2, 10, 0, 0, 0).toISOString(),
      },
    ]

    const KANBAN_COLUMNS = [
      { status: 'todo', title: 'To do' },
      { status: 'in_progress', title: 'In progress' },
      { status: 'done', title: 'Done' },
    ] as const

    const tasksForColumn = (status: Task['status']) => visibleTasks.filter((t) => t.status === status)

    const { getByRole, getAllByRole, getAllByText, getByText } = render(TasksKanbanView, {
      props: {
        visibleTasks,
        KANBAN_COLUMNS: KANBAN_COLUMNS as any,
        KANBAN_FLIP_MS: 150,
        tasksForColumn,
        handleKanbanConsider,
        handleKanbanFinalize,
        filterByTag,
        openEditModal,
        handleDeleteTask,
        statusLabel: (s) => s,
        priorityLabel: (p) => p,
        formatDate: (v) => v,
      },
    })

    expect(getByRole('region', { name: 'Tasks in kanban view' })).toBeVisible()
    expect(getAllByRole('list', { name: 'To do' }).length).toBeGreaterThan(0)
    expect(getByText('Review case bundle')).toBeVisible()

    const editButtons = getAllByText('Edit')
    await user.click(editButtons[0])
    expect(openEditModal).toHaveBeenCalled()

    const deleteButtons = getAllByText('Delete')
    await user.click(deleteButtons[0])
    expect(handleDeleteTask).toHaveBeenCalledWith('t1')

    await user.click(getByText('evidence'))
    expect(filterByTag).toHaveBeenCalledWith('evidence')
  })
})

