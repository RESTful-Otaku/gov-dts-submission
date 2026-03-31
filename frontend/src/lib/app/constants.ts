import { en as pickerEn } from 'svelty-picker/i18n'
import type { i18nType } from 'svelty-picker/i18n'
import type { TaskStatus } from '../api'

/** UK English strings for SveltyPicker (`weekStart` is set separately on each picker). */
export const PICKER_I18N: i18nType = pickerEn
export const DATETIME_FORMAT = 'dd-mm-yyyy HH:ii P'
export const DATE_FORMAT = 'dd-mm-yyyy'

export const LIST_PAGE_SIZES = [10, 20, 30] as const
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number]

export const KANBAN_COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To do' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'done', title: 'Done' },
]

export const KANBAN_FLIP_MS = 150
export const TOAST_EXIT_MS = 250
