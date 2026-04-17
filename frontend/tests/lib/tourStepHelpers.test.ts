import { describe, expect, it } from 'vitest'
import {
  autoViewModeForTourStep,
  isTaskSpotlightStep,
  isWideAutoViewTourStep,
} from '../../src/lib/app/task-app/tourStepHelpers'

describe('tourStepHelpers', () => {
  it('identifies task spotlight steps', () => {
    expect(isTaskSpotlightStep('open_task_reader')).toBe(true)
    expect(isTaskSpotlightStep('delete_task')).toBe(true)
    expect(isTaskSpotlightStep('filters')).toBe(false)
    expect(isTaskSpotlightStep(null)).toBe(false)
  })

  it('maps wide auto-view steps to the expected view mode', () => {
    expect(isWideAutoViewTourStep('list_multiselect')).toBe(true)
    expect(isWideAutoViewTourStep('list_bulk_delete')).toBe(true)
    expect(isWideAutoViewTourStep('kanban_drag')).toBe(true)
    expect(isWideAutoViewTourStep('view_modes')).toBe(false)

    expect(autoViewModeForTourStep('list_multiselect')).toBe('list')
    expect(autoViewModeForTourStep('list_bulk_delete')).toBe('list')
    expect(autoViewModeForTourStep('kanban_drag')).toBe('kanban')
  })
})
