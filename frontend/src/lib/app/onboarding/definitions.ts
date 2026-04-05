import type { OnboardingStepId, TourStepDef } from './types'

export const CHECKLIST_META: { id: OnboardingStepId; label: string; hint: string }[] = [
  { id: 'create_task', label: 'Create a task', hint: 'Save from Create task' },
  { id: 'open_task_reader', label: 'Open task details', hint: 'Tap/click a task card to open full read-only view' },
  { id: 'search', label: 'Search tasks', hint: 'Type in search field' },
  { id: 'filters', label: 'Open filters', hint: 'Funnel control' },
  { id: 'view_modes', label: 'Try another view mode', hint: 'Summary / List / Kanban (wide only)' },
  { id: 'card_swipe', label: 'Swipe a task card (mobile only)', hint: 'Right = edit, left = delete' },
  { id: 'edit_task', label: 'Edit a task', hint: 'Save changes' },
  { id: 'delete_task', label: 'Delete a task', hint: 'Confirm in dialog' },
  { id: 'theme', label: 'Use theme toggle', hint: 'Light / dark' },
  { id: 'text_size', label: 'Change text size', hint: '6-step slider' },
  { id: 'density', label: 'Adjust density', hint: 'Comfortable / compact' },
  { id: 'motion', label: 'Set motion level', hint: 'System / reduced / full' },
  { id: 'startup_view', label: 'Set startup view', hint: 'Remember or fixed view' },
  { id: 'restore_defaults', label: 'Restore defaults', hint: 'Reset all UI preferences' },
]

/** Steps that count toward the gamified checklist (excludes welcome/toolbar intro). */
export const CHECKLIST_STEP_IDS: OnboardingStepId[] = CHECKLIST_META.map((m) => m.id)

/** Ordered guided tour steps (subset is used on narrow viewports). */
export const TOUR_STEP_DEFS: TourStepDef[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'This short tour walks through the main controls. You can skip anytime, repeat from the help menu, and your progress is saved automatically.',
    targetTourAttr: null,
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    body: 'Use Create task to add work, search to find tasks, and the funnel to open filters. On small screens, tap the search field to expand it.',
    targetTourAttr: 'toolbar',
  },
  {
    id: 'theme',
    title: 'Theme',
    body: 'Switch between light and dark mode for comfortable reading in any environment.',
    targetTourAttr: 'theme',
    interactive: true,
  },
  {
    id: 'text_size',
    title: 'Text size',
    body: 'Use the six-step text scale slider to tune readability. Changes apply instantly and are saved on this device.',
    targetTourAttr: 'text-size',
    interactive: true,
  },
  {
    id: 'density',
    title: 'Density',
    body: 'Switch between comfortable and compact spacing. Compact mode fits more content across mobile and desktop.',
    targetTourAttr: 'density',
    interactive: true,
  },
  {
    id: 'motion',
    title: 'Motion',
    body: 'Choose motion behavior: follow system accessibility, force reduced motion, or force full animation.',
    targetTourAttr: 'motion',
    interactive: true,
  },
  {
    id: 'startup_view',
    title: 'Startup view',
    body: 'Choose whether the app remembers your last view or always starts in cards, list, or kanban.',
    targetTourAttr: 'startup-view',
    interactive: true,
  },
  {
    id: 'restore_defaults',
    title: 'Restore defaults',
    body: 'Use Restore defaults to quickly return to the baseline UI preferences if custom settings feel off.',
    targetTourAttr: 'restore-defaults',
    interactive: true,
  },
  {
    id: 'create_task',
    title: 'Create a task',
    body: 'Open Create task, fill in at least title and due date/time, then save. Your first task unlocks this step.',
    targetTourAttr: 'create',
    interactive: true,
  },
  {
    id: 'open_task_reader',
    title: 'Open task details',
    body: 'In Summary or Kanban, tap or click a task card to open the full read-only view. (List view uses Edit from the row instead.) That view is the quickest way to read long titles and descriptions.',
    /* Spotlight the task list/cards (not the reader modal — that mount only exists after open). */
    targetTourAttr: 'pick-task',
    interactive: true,
  },
  {
    id: 'edit_task',
    title: 'Edit a task',
    body: 'Open any task’s edit action, change something, and save to complete this step.',
    targetTourAttr: 'task-area',
    interactive: true,
  },
  {
    id: 'delete_task',
    title: 'Delete a task',
    body: 'Use delete on a task and confirm in the dialog. (Use a test task if you prefer.)',
    targetTourAttr: 'task-area',
    interactive: true,
  },
  {
    id: 'card_swipe',
    title: 'Swipe on cards',
    body: 'On small screens, swipe a task card right to open edit, or left to start delete. Edit and Delete buttons still work. Try one full swipe to complete this step.',
    targetTourAttr: 'pick-task',
    narrowOnly: true,
    interactive: true,
  },
  {
    id: 'search',
    title: 'Search',
    body: 'Type in the search field; matching tasks stay visible. Clear the field to show everything again.',
    targetTourAttr: 'search',
    interactive: true,
  },
  {
    id: 'filters',
    title: 'Filters',
    body: 'Open filters to narrow by status, priority, owner, tags, or due dates.',
    targetTourAttr: 'filter',
    interactive: true,
  },
  {
    id: 'view_modes',
    title: 'View modes',
    body: 'On wider screens, switch between Summary (cards), List, and Kanban.',
    targetTourAttr: 'view-mode',
    skipOnNarrow: true,
    wideOnly: true,
    interactive: true,
  },
]

export function tourStepsForLayout(isNarrow: boolean): TourStepDef[] {
  const list = TOUR_STEP_DEFS.filter((s) => {
    if (isNarrow && s.skipOnNarrow) return false
    if (s.wideOnly && isNarrow) return false
    if (s.narrowOnly && !isNarrow) return false
    return true
  })
  if (!isNarrow) return list
  return list.map((s) => {
    if (s.id !== 'search') return s
    return {
      ...s,
      body:
        'Type in the search field (it expands on small screens). Matching tasks stay visible. Clear the text to show everything again — the tour will shrink the search bar before the filters step so the funnel button is reachable.',
    }
  })
}

export function checklistIdsForLayout(isNarrow: boolean): OnboardingStepId[] {
  return CHECKLIST_META.filter((m) => {
    if (!isNarrow && m.id === 'card_swipe') return false
    if (isNarrow && m.id === 'view_modes') return false
    return true
  }).map((m) => m.id)
}
