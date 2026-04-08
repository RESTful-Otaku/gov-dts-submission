import type { UserRole } from '../../api'
import type { OnboardingStepId, TourStepDef } from './types'

/** Checklist / tour steps that require creating, editing, or deleting tasks (hidden for viewers). */
export const VIEWER_EXCLUDED_MUTATION_STEP_IDS = new Set<OnboardingStepId>([
  'create_task',
  'edit_task',
  'delete_task',
  'card_swipe',
  'list_multiselect',
  'list_bulk_delete',
  'kanban_drag',
])

/**
 * Narrow view: expanded search covers the toolbar row. Collapse search for these steps so Create,
 * Filter, and task-area highlights stay reachable; block expanding search during the same steps.
 */
export const TOUR_STEPS_NEED_UNOBSTRUCTED_TOOLBAR: OnboardingStepId[] = [
  'toolbar',
  'create_task',
  'filters',
  'filter_sort_demo',
  'card_swipe',
  'open_task_reader',
  'edit_task',
  'delete_task',
  'list_multiselect',
  'list_bulk_delete',
  'kanban_drag',
]

const CHECKLIST_META_COPY = [
  { id: 'create_task', label: 'Create a task', hint: 'Save from Create task' },
  { id: 'open_task_reader', label: 'Open task details', hint: 'Tap/click a task card to open full read-only view' },
  { id: 'search', label: 'Search tasks', hint: 'Type in search field' },
  { id: 'filters', label: 'Open filters', hint: 'Funnel control' },
  {
    id: 'filter_sort_demo',
    label: 'Sort tasks',
    hint: 'Change sort from the filters panel or list column headers',
  },
  { id: 'view_modes', label: 'Try another view mode', hint: 'Summary / List / Kanban (wide only)' },
  {
    id: 'list_multiselect',
    label: 'Select tasks in list view',
    hint: 'Use row checkboxes or select all (wide / list view)',
  },
  {
    id: 'list_bulk_delete',
    label: 'Bulk delete from list',
    hint: 'Choose Delete selected after selecting tasks',
  },
  {
    id: 'kanban_drag',
    label: 'Move a card in Kanban',
    hint: 'Drag a card to another column to change status',
  },
  { id: 'card_swipe', label: 'Swipe a task card (mobile only)', hint: 'Right = edit, left = delete' },
  { id: 'edit_task', label: 'Edit a task', hint: 'Save changes' },
  { id: 'delete_task', label: 'Delete a task', hint: 'Confirm in dialog' },
  { id: 'theme', label: 'Use theme toggle', hint: 'Light / dark' },
  { id: 'text_size', label: 'Change text size', hint: '6-step slider' },
  { id: 'density', label: 'Adjust density', hint: 'Comfortable / compact' },
  { id: 'motion', label: 'Set motion level', hint: 'System / reduced / full' },
  { id: 'startup_view', label: 'Set startup view', hint: 'Remember or fixed view' },
  { id: 'restore_defaults', label: 'Restore defaults', hint: 'Reset all UI preferences' },
  {
    id: 'admin_main_tabs',
    label: 'Use admin toolbar sections',
    hint: 'Switch to Users or Audit from the toolbar (admins, wide layout)',
    requiresAdmin: true,
  },
  {
    id: 'admin_users_filters',
    label: 'Filter and sort users',
    hint: 'On Users: open filters, search, pick a role, sort columns, paginate',
    requiresAdmin: true,
  },
  {
    id: 'admin_audit_review',
    label: 'Review audit logs',
    hint: 'Open Audit to inspect changes with filters; sort via column headers',
    requiresAdmin: true,
  },
 ] as const

export const CHECKLIST_META: {
  id: OnboardingStepId
  label: string
  hint: string
  requiresAdmin?: boolean
}[] = [...CHECKLIST_META_COPY]

/** Steps that count toward the gamified checklist (excludes welcome/toolbar intro). */
export const CHECKLIST_STEP_IDS: OnboardingStepId[] = CHECKLIST_META.map((m) => m.id)

/** Ordered guided tour steps (subset is used on narrow viewports). */
const TOUR_STEP_DEFS_COPY = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'This short tour walks through the main controls. You can skip anytime, repeat from the help menu, and your progress is saved automatically.',
    targetTourAttr: null,
  },
  {
    id: 'toolbar',
    title: 'Toolbar',
    body:
      'Use Create task to add work, search to find tasks, and the funnel for filters. When you scroll down, the title row can tuck away while filter, jump to top, and Help (☰) stay on one row. During this tour the full header stays visible so the highlighted controls line up.',
    targetTourAttr: 'toolbar',
  },
  {
    id: 'theme',
    title: 'Theme',
    body: 'Switch between light and dark mode for comfortable reading in any environment.',
    targetTourAttr: 'help-settings-theme',
    interactive: true,
  },
  {
    id: 'text_size',
    title: 'Text size',
    body: 'Use the six-step text scale slider to tune readability. Changes apply instantly and are saved on this device.',
    targetTourAttr: 'help-settings-text-size',
    interactive: true,
  },
  {
    id: 'density',
    title: 'Density',
    body: 'Switch between comfortable and compact spacing. Compact mode fits more content across mobile and desktop.',
    targetTourAttr: 'help-settings-density',
    interactive: true,
  },
  {
    id: 'motion',
    title: 'Motion',
    body: 'Choose motion behavior: follow system accessibility, force reduced motion, or force full animation.',
    targetTourAttr: 'help-settings-motion',
    interactive: true,
  },
  {
    id: 'startup_view',
    title: 'Startup view',
    body: 'Choose whether the app remembers your last view or always starts in cards, list, or kanban.',
    targetTourAttr: 'help-settings-startup',
    interactive: true,
  },
  {
    id: 'restore_defaults',
    title: 'Restore defaults',
    body: 'Use Restore defaults to quickly return to the baseline UI preferences if custom settings feel off.',
    targetTourAttr: 'help-settings-restore',
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
    body: 'Follow the highlight: in Summary or Kanban, tap or click the card to open the read-only viewer. In List view, use Edit on the highlighted row to change a task (there is no separate reader there).',
    targetTourAttr: 'tour-spot-open',
    interactive: true,
  },
  {
    id: 'edit_task',
    title: 'Edit a task',
    body: 'Use the highlighted Edit control, change something, and save. Other actions stay dimmed until you finish.',
    targetTourAttr: 'tour-spot-edit',
    interactive: true,
  },
  {
    id: 'delete_task',
    title: 'Delete a task',
    body: 'Use the highlighted Delete control and confirm in the dialog. (Use a test task if you prefer.)',
    targetTourAttr: 'tour-spot-delete',
    interactive: true,
  },
  {
    id: 'card_swipe',
    title: 'Swipe on cards',
    body: 'On small screens, swipe the highlighted card right to edit, or left to delete. Edit and Delete buttons still work. Try one full swipe to complete this step.',
    targetTourAttr: 'tour-spot-swipe',
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
    id: 'filter_sort_demo',
    title: 'Sort tasks',
    body: 'With filters open, use Sort to pick the field and Asc/Des for direction. In List view you can also click a column title: the active column shows ↑ or ↓, and other sortable columns show ⇕ until selected.',
    targetTourAttr: 'filter-sort',
    skipOnNarrow: true,
    wideOnly: true,
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
  {
    id: 'list_multiselect',
    title: 'List view — multi-select',
    body: 'Switch to List view if needed. Use the header checkbox or row boxes to select one or more tasks. The bulk toolbar appears when anything is selected.',
    targetTourAttr: 'tour-list-select',
    skipOnNarrow: true,
    wideOnly: true,
    interactive: true,
  },
  {
    id: 'list_bulk_delete',
    title: 'List view — bulk delete',
    body: 'With tasks selected, use Delete selected to remove them in one go (you can cancel in the confirmation dialog). Mark as also offers quick status updates for the selection.',
    targetTourAttr: 'tour-list-bulk-delete',
    skipOnNarrow: true,
    wideOnly: true,
    interactive: true,
  },
  {
    id: 'kanban_drag',
    title: 'Kanban — drag to change status',
    body: 'Switch to Kanban. Drag the highlighted card into another column; when you drop, its status updates. You can still open, edit, or delete from the card.',
    targetTourAttr: 'tour-kanban-drag',
    skipOnNarrow: true,
    wideOnly: true,
    interactive: true,
  },
  {
    id: 'admin_main_tabs',
    title: 'Admin sections',
    body: 'As an administrator, use Tasks for everyday work, Users to manage accounts, and Audit to review changes. These tabs sit beside the view mode controls.',
    targetTourAttr: 'admin-main-tab',
    skipOnNarrow: true,
    wideOnly: true,
    requiresAdmin: true,
    interactive: true,
  },
  {
    id: 'admin_users_filters',
    title: 'User administration',
    body: 'On the Users tab, search and filter by role, sort the table, and use pagination. Edit names from the row actions, send password resets, adjust roles, or remove accounts. Bulk actions apply when you select rows.',
    targetTourAttr: 'admin-users-panel',
    skipOnNarrow: true,
    wideOnly: true,
    requiresAdmin: true,
    interactive: true,
  },
  {
    id: 'admin_audit_review',
    title: 'Audit trail',
    body: 'The Audit tab lists create, edit, and delete events. Filter by person, text, or changed field. Click a column heading to sort: ↑/↓ on the active column, ⇕ on the others (Raw data is not sortable).',
    targetTourAttr: 'admin-audit-panel',
    skipOnNarrow: true,
    wideOnly: true,
    requiresAdmin: true,
    interactive: true,
  },
 ] as const

export const TOUR_STEP_DEFS: TourStepDef[] = [...TOUR_STEP_DEFS_COPY]

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

/** Tour steps for the signed-in user’s role (viewers skip mutation steps; non-admins skip admin-only steps). */
export function tourStepsForRoleAndLayout(isNarrow: boolean, role: UserRole | null): TourStepDef[] {
  return tourStepsForLayout(isNarrow).filter((s) => {
    if (s.requiresAdmin && role !== 'admin') return false
    if (role === 'viewer' && VIEWER_EXCLUDED_MUTATION_STEP_IDS.has(s.id)) return false
    return true
  })
}

export function checklistIdsForLayout(isNarrow: boolean): OnboardingStepId[] {
  const wideOnly = new Set<OnboardingStepId>([
    'filter_sort_demo',
    'list_multiselect',
    'list_bulk_delete',
    'kanban_drag',
    'admin_main_tabs',
    'admin_users_filters',
    'admin_audit_review',
  ])
  return CHECKLIST_META.filter((m) => {
    if (!isNarrow && m.id === 'card_swipe') return false
    if (isNarrow && m.id === 'view_modes') return false
    if (isNarrow && wideOnly.has(m.id)) return false
    return true
  }).map((m) => m.id)
}

export function checklistIdsForRoleAndLayout(isNarrow: boolean, role: UserRole | null): OnboardingStepId[] {
  const layoutIds = new Set(checklistIdsForLayout(isNarrow))
  return CHECKLIST_META.filter((m) => {
    if (!layoutIds.has(m.id)) return false
    if (m.requiresAdmin && role !== 'admin') return false
    if (role === 'viewer' && VIEWER_EXCLUDED_MUTATION_STEP_IDS.has(m.id)) return false
    return true
  }).map((m) => m.id)
}
