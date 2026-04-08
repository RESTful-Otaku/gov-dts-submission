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

/** Minimum viewport width for Users / Audit admin UI (not shown on native or narrower viewports). */
export const ADMIN_UI_MIN_WIDTH_PX = 900

/** `mailto:` for “contact administrator” links; override with `VITE_ADMIN_CONTACT_EMAIL`. */
export function adminContactMailtoHref(): string {
  const email = String(import.meta.env.VITE_ADMIN_CONTACT_EMAIL ?? 'admin@example.gov').trim() || 'admin@example.gov'
  const subject = encodeURIComponent('Casework task manager — account help')
  return `mailto:${email}?subject=${subject}`
}
