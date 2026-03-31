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
  if (!title.trim()) return 'Title is required'
  if (!dueDateTimeStr?.trim()) return 'Due date and time are required'
  const iso = dueAtIsoFromPicker(dueDateTimeStr, parseDateTimeUK)
  if (!iso) return 'Due date/time is invalid (use DD-MM-YYYY and 12-hour time)'
  if (new Date(iso).getTime() < Date.now()) return 'Due date/time must be in the future'
  return null
}
