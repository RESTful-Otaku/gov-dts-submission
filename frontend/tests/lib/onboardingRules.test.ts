import { describe, expect, it } from 'vitest'
import type { TourStepDef } from '../../src/lib/app/onboarding/types'
import {
  currentTourStepId,
  helpTabForPinnedSettingsStep,
  isInvalidTourState,
  nextAutoViewModeForTourStep,
  shouldCollapseMobileSearchForTourStep,
  shouldCompleteListMultiSelectStep,
  shouldKeepHelpPinnedForSettingsStep,
  shouldSeedBulkDeleteSelection,
} from '../../src/lib/app/task-app/onboardingRules'

describe('onboardingRules', () => {
  it('derives current step id and validates tour state', () => {
    const steps = [{ id: 'welcome' }, { id: 'toolbar' }] as TourStepDef[]
    expect(currentTourStepId(steps, 1)).toBe('toolbar')
    expect(currentTourStepId(steps, 99)).toBeNull()

    expect(isInvalidTourState(false, steps, 0)).toBe(false)
    expect(isInvalidTourState(true, [], 0)).toBe(true)
    expect(isInvalidTourState(true, steps, 99)).toBe(true)
    expect(isInvalidTourState(true, steps, 1)).toBe(false)
  })

  it('pins help for settings steps and collapses mobile search for protected steps', () => {
    expect(shouldKeepHelpPinnedForSettingsStep(true, 'theme')).toBe(true)
    expect(shouldKeepHelpPinnedForSettingsStep(true, 'filters')).toBe(false)
    expect(helpTabForPinnedSettingsStep()).toBe('settings')

    expect(shouldCollapseMobileSearchForTourStep(true, true, 'toolbar')).toBe(true)
    expect(shouldCollapseMobileSearchForTourStep(true, true, 'search')).toBe(false)
  })

  it('returns list/kanban progression decisions', () => {
    expect(shouldCompleteListMultiSelectStep(true, 'list_multiselect', 'list', 1)).toBe(true)
    expect(shouldCompleteListMultiSelectStep(true, 'list_multiselect', 'cards', 1)).toBe(false)

    expect(shouldSeedBulkDeleteSelection(true, 'list_bulk_delete', 'list', 2, 0)).toBe(true)
    expect(shouldSeedBulkDeleteSelection(true, 'list_bulk_delete', 'list', 2, 1)).toBe(false)

    expect(nextAutoViewModeForTourStep(true, false, 'kanban_drag', null)).toEqual({
      nextStepId: 'kanban_drag',
      viewMode: 'kanban',
    })
    expect(nextAutoViewModeForTourStep(true, false, 'list_multiselect', null)).toEqual({
      nextStepId: 'list_multiselect',
      viewMode: 'list',
    })
    expect(nextAutoViewModeForTourStep(true, false, 'list_multiselect', 'list_multiselect')).toEqual({
      nextStepId: 'list_multiselect',
      viewMode: null,
    })
  })
})
