import { UI_MESSAGES } from '../app/messages'

/** Split comma/semicolon-separated tags from modal inputs. */
export function parseTagsInput(tagsInput: string): string[] {
  return tagsInput
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function dueAtIsoFromPicker(
  dueDateTimeStr: string,
  parseDateTimeUK: (s: string) => string | null,
): string | null {
  if (!dueDateTimeStr?.trim()) return null
  return parseDateTimeUK(dueDateTimeStr)
}

/** Returns a user-facing validation error, or null if the create form is valid. */
export function validateCreateTaskForm(
  title: string,
  dueDateTimeStr: string,
  parseDateTimeUK: (s: string) => string | null,
): string | null {
  if (!title.trim()) return UI_MESSAGES.taskFormTitleRequired
  if (!dueDateTimeStr?.trim()) return UI_MESSAGES.taskFormDueRequired
  const iso = dueAtIsoFromPicker(dueDateTimeStr, parseDateTimeUK)
  if (!iso) return UI_MESSAGES.taskFormDueInvalid
  if (new Date(iso).getTime() < Date.now()) return UI_MESSAGES.taskFormDueFuture
  return null
}
