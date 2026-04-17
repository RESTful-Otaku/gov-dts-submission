import type { ViewMode } from '../types'
import type { OnboardingStepId } from '../onboarding/types'

const TASK_SPOTLIGHT_STEPS = new Set<OnboardingStepId>([
  'open_task_reader',
  'edit_task',
  'delete_task',
  'card_swipe',
  'kanban_drag',
])

export function isTaskSpotlightStep(id: OnboardingStepId | null): boolean {
  return !!id && TASK_SPOTLIGHT_STEPS.has(id)
}

export function isWideAutoViewTourStep(id: OnboardingStepId | null): boolean {
  return id === 'list_multiselect' || id === 'list_bulk_delete' || id === 'kanban_drag'
}

export function autoViewModeForTourStep(id: OnboardingStepId): ViewMode {
  return id === 'kanban_drag' ? 'kanban' : 'list'
}
