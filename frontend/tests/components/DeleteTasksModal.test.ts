import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import type { Task } from '../../src/lib/api'
import DeleteTasksModal from '../../src/components/modals/DeleteTasksModal.svelte'

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    description: partial.description ?? null,
    status: partial.status ?? 'todo',
    priority: partial.priority,
    owner: partial.owner ?? '',
    tags: partial.tags ?? [],
    dueAt: partial.dueAt ?? new Date().toISOString(),
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  }
}

describe('DeleteTasksModal', () => {
  it('calls close and performDeleteTask from actions', () => {
    const closeDeleteModal = vi.fn()
    const performDeleteTask = vi.fn()
    const handleModalBackdropClick = vi.fn()

    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'Task A', status: 'done' }),
      makeTask({ id: 'b', title: 'Task B', status: 'todo' }),
    ]

    const { getByRole, getByLabelText, getByText } = render(DeleteTasksModal, {
      props: {
        tasks,
        deleteModalTaskIds: ['a', 'b'],
        handleModalBackdropClick,
        closeDeleteModal,
        performDeleteTask,
      },
    })

    // Backdrop click
    fireEvent.click(getByRole('dialog'))
    expect(handleModalBackdropClick).toHaveBeenCalledTimes(1)

    // Cancel
    fireEvent.click(getByText('Cancel'))
    expect(closeDeleteModal).toHaveBeenCalledTimes(1)

    // Delete
    fireEvent.click(getByText('Delete tasks'))
    expect(performDeleteTask).toHaveBeenCalledTimes(1)

    // Close icon
    fireEvent.click(getByLabelText('Close'))
    expect(closeDeleteModal).toHaveBeenCalledTimes(2)
  })
})

