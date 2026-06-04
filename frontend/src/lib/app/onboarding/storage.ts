import type { UserRole } from '../../api'
import type { OnboardingStepId } from './types'
import { CHECKLIST_STEP_IDS, checklistIdsForRoleAndLayout } from './definitions'

const STORAGE_VERSION = '1'
const KEY_AUTO_DISMISS = 'task-app-onboarding-auto-dismiss-v' + STORAGE_VERSION
const KEY_CHECKLIST = 'task-app-onboarding-checklist-v' + STORAGE_VERSION

export function emptyChecklist(): Record<OnboardingStepId, boolean> {
  const o = {} as Record<OnboardingStepId, boolean>
  for (const id of CHECKLIST_STEP_IDS) {
    o[id] = false
  }
  return o
}

export function loadChecklist(): Record<OnboardingStepId, boolean> {
  const base = emptyChecklist()
  try {
    const raw = localStorage.getItem(KEY_CHECKLIST)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Record<string, boolean>
    for (const id of CHECKLIST_STEP_IDS) {
      if (typeof parsed[id] === 'boolean') base[id] = parsed[id]
    }
  } catch {
    /* ignore */
  }
  return base
}

export function saveChecklist(checklist: Record<OnboardingStepId, boolean>): void {
  try {
    const slice: Record<string, boolean> = {}
    for (const id of CHECKLIST_STEP_IDS) {
      slice[id] = !!checklist[id]
    }
    localStorage.setItem(KEY_CHECKLIST, JSON.stringify(slice))
  } catch {
    /* ignore */
  }
}

/** After this is set, the app will not auto-open the help guide on first paint. */
export function isAutoHelpDismissed(): boolean {
  try {
    return localStorage.getItem(KEY_AUTO_DISMISS) === '1'
  } catch {
    return false
  }
}

export function setAutoHelpDismissed(): void {
  try {
    localStorage.setItem(KEY_AUTO_DISMISS, '1')
  } catch {
    /* ignore */
  }
}

/** Clear onboarding prefs (e.g. from help “Reset progress”). */
export function resetOnboardingStorage(): void {
  try {
    localStorage.removeItem(KEY_AUTO_DISMISS)
    localStorage.removeItem(KEY_CHECKLIST)
  } catch {
    /* ignore */
  }
}

export function checklistProgress(
  checklist: Record<OnboardingStepId, boolean>,
  isNarrow: boolean,
  role: UserRole | null = null,
): { done: number; total: number } {
  const ids = checklistIdsForRoleAndLayout(isNarrow, role)
  let done = 0
  for (const id of ids) {
    if (checklist[id]) done++
  }
  return { done, total: ids.length }
}
