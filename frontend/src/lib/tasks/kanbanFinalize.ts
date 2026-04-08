import type { Task, TaskStatus } from '../api'
import { apiErrorMessage } from '../api'
import { assertInvariant } from '../app/invariant'
import { UI_MESSAGES } from '../app/messages'
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
  const uniqueIds = new Set(items.map((item) => item.id))
  if (!assertInvariant(uniqueIds.size === items.length, 'kanban finalize received duplicate task ids')) {
    return false
  }
  const previousTasks = [...tasks]
  const changedCount = items.reduce((count, item) => {
    const prev = previousTasks.find((t) => t.id === item.id)
    return prev && prev.status !== status ? count + 1 : count
  }, 0)
  if (!assertInvariant(changedCount <= 1, 'kanban finalize expected at most one status mutation')) {
    return false
  }
  setTasks(mergeColumnIntoTasks(tasks, status, items))
  for (const item of items) {
    const prev = previousTasks.find((t) => t.id === item.id)
    if (prev && prev.status !== status) {
      try {
        await updateTaskStatus(item.id, { status })
        showToast(UI_MESSAGES.statusUpdated, 'notification')
        return true
      } catch (err) {
        setTasks(previousTasks)
        showToast(apiErrorMessage(err, UI_MESSAGES.failedUpdateStatus), 'error')
        return false
      }
    }
  }
  return false
}
