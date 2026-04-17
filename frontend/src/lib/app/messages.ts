export const UI_MESSAGES = {
  tourComplete: 'Tour complete. Replay any time from Help -> Sections.',
  tutorialProgressCleared: 'Tutorial progress cleared.',
  settingsRestored: 'Settings restored to defaults.',
  enterTaskTitle: 'Enter a title for the task.',
  enterValidDueDateTime: 'Enter a valid due date and time using the picker.',
  dueDateMustBeFuture: 'Due date/time must be in the future.',
  titleRequired: 'Title is required.',
  taskFormTitleRequired: 'Title is required',
  taskFormDueRequired: 'Due date and time are required',
  taskFormDueInvalid: 'Due date/time is invalid (use DD-MM-YYYY and 12-hour time)',
  taskFormDueFuture: 'Due date/time must be in the future',
  taskCreated: 'Task created.',
  taskUpdated: 'Task updated.',
  statusUpdated: 'Status updated.',
  taskDeleted: 'Task deleted.',
  failedDeleteTask: 'Failed to delete task',
  failedUpdateStatus: 'Failed to update status',
  failedLoadTasks: 'Failed to load tasks',
  failedCreateTask: 'Failed to create task',
  failedUpdateTask: 'Failed to update task',
  savedViewNameRequired: 'Enter a name for the saved view.',
  savedViewSaved: 'Saved view stored.',
  savedViewUpdated: 'Saved view updated.',
  savedViewApplied: 'Saved view applied.',
  savedViewDeleted: 'Saved view deleted.',
  undo: 'Undo',
  deletePendingUndo: 'Tasks removed. Undo?',
  statusPendingUndo: 'Status updated. Undo?',
  deleteCommitted: 'Tasks deleted.',
} as const

export function statusUpdatedForCount(count: number): string {
  return count === 1 ? UI_MESSAGES.statusUpdated : `Status updated for ${count} tasks.`
}

export function deletedForCount(count: number): string {
  return count === 1 ? UI_MESSAGES.taskDeleted : `${count} tasks deleted.`
}
