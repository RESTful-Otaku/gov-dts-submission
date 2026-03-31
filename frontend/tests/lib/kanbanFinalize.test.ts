import { describe, expect, it, vi } from 'vitest'
import type { Task, TaskStatus } from '../../src/lib/api'
import { finalizeKanbanColumnDrop } from '../../src/lib/tasks/kanbanFinalize'

function t(id: string, status: TaskStatus): Task {
  return {
    id,
    title: id,
    status,
    dueAt: '2026-06-01T12:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('finalizeKanbanColumnDrop', () => {
  it('reverts tasks when status update fails', async () => {
    const initial = [t('1', 'todo'), t('2', 'in_progress')]
    let tasks = [...initial]
    const showToast = vi.fn()
    const updateTaskStatus = vi.fn().mockRejectedValue(new Error('network'))

    await finalizeKanbanColumnDrop({
      status: 'done',
      items: [t('1', 'todo')],
      tasks,
      setTasks: (next) => {
        tasks = next
      },
      updateTaskStatus,
      showToast,
    })

    expect(updateTaskStatus).toHaveBeenCalled()
    expect(tasks).toEqual(initial)
    expect(showToast).toHaveBeenCalledWith('network', 'error')
  })

  it('calls showToast on success when status changes', async () => {
    const initial = [t('1', 'todo')]
    let tasks = [...initial]
    const showToast = vi.fn()
    const updateTaskStatus = vi.fn().mockResolvedValue(t('1', 'done'))

    await finalizeKanbanColumnDrop({
      status: 'done',
      items: [t('1', 'todo')],
      tasks,
      setTasks: (next) => {
        tasks = next
      },
      updateTaskStatus,
      showToast,
    })

    expect(updateTaskStatus).toHaveBeenCalledWith('1', { status: 'done' })
    expect(showToast).toHaveBeenCalledWith('Status updated.', 'notification')
  })
})
