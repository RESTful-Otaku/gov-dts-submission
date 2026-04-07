/** Interactive checklist / tour step identifiers (persisted in localStorage). */
export type OnboardingStepId =
  | 'welcome'
  | 'toolbar'
  | 'theme'
  | 'text_size'
  | 'density'
  | 'motion'
  | 'startup_view'
  | 'restore_defaults'
  | 'create_task'
  | 'open_task_reader'
  | 'edit_task'
  | 'delete_task'
  | 'card_swipe'
  | 'search'
  | 'filters'
  | 'filter_sort_demo'
  | 'view_modes'
  | 'list_multiselect'
  | 'list_bulk_delete'
  | 'kanban_drag'

export type HelpTabId = 'guide' | 'checklist' | 'sections' | 'settings' | 'about'

export type TourStepDef = {
  id: OnboardingStepId
  title: string
  body: string
  /** `data-tour` value on a host element; null = no spotlight */
  targetTourAttr: string | null
  /** Omit from tour on narrow (≤640px) layouts */
  skipOnNarrow?: boolean
  /** Only include on wide layouts */
  wideOnly?: boolean
  /** Only include on narrow (mobile) layouts */
  narrowOnly?: boolean
  /** Completed by user action (not “Next” alone) */
  interactive?: boolean
}
