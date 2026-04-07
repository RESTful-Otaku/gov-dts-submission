import type { Task, TaskStatus } from '../api'
import { mergeColumnIntoTasks } from './kanban'
import type { ToastType } from '../app/types'

export async function finalizeKanbanColumnDrop(options: {
  status: TaskStatus
  items: Task[]
  tasks: Task[]
  setTasks: (next: Task[]) => void
  updateTaskStatus: (id: string, payload: { status: TaskStatus }) => Promise<Task>
  showToast: (message: string, type: ToastType) => void
}): Promise<boolean> {
  const { status, items, tasks, setTasks, updateTaskStatus, showToast } = options
  const previousTasks = [...tasks]
  setTasks(mergeColumnIntoTasks(tasks, status, items))
  for (const item of items) {
    const prev = previousTasks.find((t) => t.id === item.id)
    if (prev && prev.status !== status) {
      try {
        await updateTaskStatus(item.id, { status })
        showToast('Status updated.', 'notification')
        return true
      } catch (err) {
        setTasks(previousTasks)
        showToast(err instanceof Error ? err.message : 'Failed to update status', 'error')
        return false
      }
    }
  }
  return false
}
