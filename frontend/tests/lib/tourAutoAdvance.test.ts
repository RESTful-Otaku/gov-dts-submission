import { describe, expect, it } from 'vitest'
import {
  nextAutoAdvanceStepId,
  shouldExecuteAutoAdvance,
} from '../../src/lib/app/task-app/tourAutoAdvance'
import type { TourStepDef } from '../../src/lib/app/onboarding/types'

describe('tourAutoAdvance helpers', () => {
  it('selects auto-advance step only when tour interactive step is completed', () => {
    const interactive = { id: 'filters', interactive: true } as TourStepDef
    const passive = { id: 'welcome' } as TourStepDef
    const checklist = {
      welcome: false,
      toolbar: false,
      theme: false,
      text_size: false,
      density: false,
      motion: false,
      startup_view: false,
      restore_defaults: false,
      create_task: false,
      open_task_reader: false,
      edit_task: false,
      delete_task: false,
      card_swipe: false,
      search: false,
      filters: true,
      filter_sort_demo: false,
      view_modes: false,
      list_multiselect: false,
      list_bulk_delete: false,
      kanban_drag: false,
    }

    expect(nextAutoAdvanceStepId(true, interactive, checklist)).toBe('filters')
    expect(nextAutoAdvanceStepId(true, passive, checklist)).toBeNull()
    expect(nextAutoAdvanceStepId(false, interactive, checklist)).toBeNull()
  })

  it('guards auto-advance execution by generation and current step', () => {
    const steps = [
      { id: 'welcome' },
      { id: 'filters', interactive: true },
    ] as TourStepDef[]
    const checklist = {
      welcome: false,
      toolbar: false,
      theme: false,
      text_size: false,
      density: false,
      motion: false,
      startup_view: false,
      restore_defaults: false,
      create_task: false,
      open_task_reader: false,
      edit_task: false,
      delete_task: false,
      card_swipe: false,
      search: false,
      filters: true,
      filter_sort_demo: false,
      view_modes: false,
      list_multiselect: false,
      list_bulk_delete: false,
      kanban_drag: false,
    }

    expect(
      shouldExecuteAutoAdvance({
        generationAtSchedule: 1,
        currentGeneration: 1,
        tourRunning: true,
        steps,
        stepIndex: 1,
        expectedStepId: 'filters',
        checklist,
      }),
    ).toBe(true)

    expect(
      shouldExecuteAutoAdvance({
        generationAtSchedule: 1,
        currentGeneration: 2,
        tourRunning: true,
        steps,
        stepIndex: 1,
        expectedStepId: 'filters',
        checklist,
      }),
    ).toBe(false)
  })
})
