import { TOUR_STEPS_NEED_UNOBSTRUCTED_TOOLBAR } from '../onboarding/definitions'
import type { OnboardingStepId, TourStepDef } from '../onboarding/types'
import type { HelpTabId } from '../onboarding/types.ts'
import type { ViewMode } from '../types.ts'
import { autoViewModeForTourStep, isWideAutoViewTourStep } from './tourStepHelpers'

const SETTINGS_TOUR_STEP_IDS = new Set<OnboardingStepId>([
  'theme',
  'text_size',
  'density',
  'motion',
  'startup_view',
  'restore_defaults',
])

export function currentTourStepId(steps: TourStepDef[], stepIndex: number): OnboardingStepId | null {
  return steps[stepIndex]?.id ?? null
}

export function isInvalidTourState(tourRunning: boolean, steps: TourStepDef[], stepIndex: number): boolean {
  if (!tourRunning) return false
  return steps.length === 0 || stepIndex < 0 || stepIndex >= steps.length || !steps[stepIndex]
}

export function shouldKeepHelpPinnedForSettingsStep(
  tourRunning: boolean,
  stepId: OnboardingStepId | null,
): boolean {
  return !!tourRunning && !!stepId && SETTINGS_TOUR_STEP_IDS.has(stepId)
}

export function shouldCollapseMobileSearchForTourStep(
  tourRunning: boolean,
  isNarrow: boolean,
  stepId: OnboardingStepId | null,
): boolean {
  return !!tourRunning && !!isNarrow && !!stepId && TOUR_STEPS_NEED_UNOBSTRUCTED_TOOLBAR.includes(stepId)
}

export function shouldCompleteListMultiSelectStep(
  tourRunning: boolean,
  stepId: OnboardingStepId | null,
  viewMode: ViewMode,
  selectedCount: number,
): boolean {
  return !!tourRunning && stepId === 'list_multiselect' && viewMode === 'list' && selectedCount >= 1
}

export function shouldSeedBulkDeleteSelection(
  tourRunning: boolean,
  stepId: OnboardingStepId | null,
  viewMode: ViewMode,
  visibleCount: number,
  selectedCount: number,
): boolean {
  return (
    !!tourRunning &&
    stepId === 'list_bulk_delete' &&
    viewMode === 'list' &&
    visibleCount > 0 &&
    selectedCount === 0
  )
}

export function nextAutoViewModeForTourStep(
  tourRunning: boolean,
  isNarrow: boolean,
  stepId: OnboardingStepId | null,
  lastAutoStepId: OnboardingStepId | null,
): { nextStepId: OnboardingStepId | null; viewMode: ViewMode | null } {
  if (!tourRunning || isNarrow || !stepId || !isWideAutoViewTourStep(stepId)) {
    return { nextStepId: null, viewMode: null }
  }
  if (lastAutoStepId === stepId) {
    return { nextStepId: lastAutoStepId, viewMode: null }
  }
  return { nextStepId: stepId, viewMode: autoViewModeForTourStep(stepId) }
}

export function helpTabForPinnedSettingsStep(): HelpTabId {
  return 'settings'
}
