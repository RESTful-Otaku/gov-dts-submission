import type { OnboardingStepId, TourStepDef } from '../onboarding/types'

export const TOUR_AUTO_ADVANCE_DELAY_MS = 520

export function nextAutoAdvanceStepId(
  tourRunning: boolean,
  step: TourStepDef | undefined,
  checklist: Record<OnboardingStepId, boolean>,
): OnboardingStepId | null {
  if (!tourRunning) return null
  if (!step?.interactive) return null
  if (!checklist[step.id]) return null
  return step.id
}

export function shouldExecuteAutoAdvance(args: {
  generationAtSchedule: number
  currentGeneration: number
  tourRunning: boolean
  steps: TourStepDef[]
  stepIndex: number
  expectedStepId: OnboardingStepId
  checklist: Record<OnboardingStepId, boolean>
}): boolean {
  const {
    generationAtSchedule,
    currentGeneration,
    tourRunning,
    steps,
    stepIndex,
    expectedStepId,
    checklist,
  } = args
  if (generationAtSchedule !== currentGeneration) return false
  if (!tourRunning) return false
  const now = steps[stepIndex]
  if (!now || now.id !== expectedStepId) return false
  return !!checklist[expectedStepId]
}
