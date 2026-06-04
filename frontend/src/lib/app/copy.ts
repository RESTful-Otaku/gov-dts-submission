import type { SortKey } from './types'

const EN_GB_COPY = {
  common: {
    close: 'Close',
    editTask: 'Edit task',
    deleteTask: 'Delete task',
    edit: 'Edit',
    delete: 'Delete',
    filterByTag: 'Filter by this tag',
    noDataDash: '—',
    notifications: 'Notifications',
    dismiss: 'Dismiss',
  },
  header: {
    appTitle: 'Caseworker task manager',
    appSubtitle: 'Capture, prioritise, and complete tasks.',
  },
  tasks: {
    controlsAria: 'View, search, and sort tasks',
    createTask: 'Create task',
    createTaskAria: 'Create a new task',
    searchPlaceholderCompact: 'Search…',
    searchPlaceholderWide: 'Title, description...',
    searchTitle: 'Search by title, description, status, or date',
    clearFilters: 'Clear filters',
    clear: 'Clear',
    clearFiltersAria: 'Clear all filters',
    clearFiltersTitle: 'Clear status, priority, owner, tags, and date filters',
    toggleFiltersAria: 'Toggle filters',
    toggleFiltersTitle: 'Show or hide filters',
    backToTop: 'Back to top',
    top: 'Top',
    activeSummaryAria: 'Active filters and query summary',
    removeFilterChipPrefix: 'Remove',
    chipSearchPrefix: 'Search',
    chipStatusPrefix: 'Status',
    chipPriorityPrefix: 'Priority',
    chipOwnerPrefix: 'Owner',
    chipTagPrefix: 'Tag',
    chipDueFromPrefix: 'Due from',
    chipDueToPrefix: 'Due to',
    chipSortPrefix: 'Sort',
    filters: {
      regionAria: 'Advanced filters and sorting',
      statusLabel: 'Status',
      statusAria: 'Filter by status',
      priorityLabel: 'Priority',
      priorityAria: 'Filter by priority',
      ownerLabel: 'Owner',
      ownerAria: 'Filter by owner',
      tagsLabel: 'Tags',
      tagsAria: 'Add tag to filter',
      allStatuses: 'All statuses',
      allPriorities: 'All priorities',
      allOwners: 'All owners',
      addTag: 'Add a tag…',
      activeTagsAria: 'Active tag filters. Remove a tag to stop filtering by it.',
      removeTagAriaPrefix: 'Remove tag filter ',
      removeTagTitlePrefix: 'Remove “',
      removeTagTitleSuffix: '” from filters',
      savedViewsLabel: 'Saved views',
      savedViewsAria: 'Saved filter and sort views',
      savedViewsPlaceholder: 'Select a saved view',
      savedViewNamePlaceholder: 'Name current view',
      saveCurrentView: 'Save view',
      applySavedView: 'Apply view',
      deleteSavedView: 'Delete view',
    },
    sort: {
      label: 'Sort',
      aria: 'Sort tasks by',
      byDueDateTime: 'Due date and time',
      byTitle: 'Title (A–Z)',
      byPriority: 'Priority',
      byOwner: 'Owner',
      byStatus: 'Status',
      byTags: 'Tags',
      byCreated: 'Created',
      ascAria: 'Sort ascending',
      descAria: 'Sort descending',
      ascShort: 'Asc',
      descShort: 'Des',
    },
    dueDateRange: {
      from: 'Due from',
      to: 'Due to',
      placeholder: 'DD-MM-YYYY',
    },
    views: {
      viewModeAria: 'View mode',
      summaryView: 'Summary view',
      summary: 'Summary',
      listView: 'List view',
      list: 'List',
      kanbanView: 'Kanban view',
      kanban: 'Kanban',
      cardsRegionAria: 'Tasks in summary cards view',
      listRegionAria: 'Tasks in list view',
      kanbanRegionAria: 'Tasks in kanban view',
      emptyState: 'No tasks match your current search or filters.',
      ownerPrefix: 'Owner:',
      dueTerm: 'Due',
      createdTerm: 'Created',
      kanbanEmpty: 'Drop tasks here or add via Create task.',
      quickAddAria: 'Quick add task',
      quickAddPlaceholder: 'Quick add: enter title...',
      quickAddTitleAria: 'Task title',
      quickAddDatePlaceholder: 'DD-MM-YYYY HH:MM AM/PM',
      quickAddButtonAria: 'Add task',
      quickAddAdd: 'Add',
      quickAddAdding: 'Adding…',
      bulkActionsAria: 'Bulk actions for selected tasks',
      selectedSuffix: 'selected',
      markAs: 'Mark as:',
      markSelectedPrefix: 'Mark selected tasks as ',
      deleteSelected: 'Delete selected',
      deleteSelectedAria: 'Delete selected tasks',
      clearSelection: 'Clear selection',
      clearSelectionAria: 'Clear selection',
      allSelectedPrefix: 'All ',
      allSelectedSuffix: ' tasks selected.',
      tasksInListSuffix: ' tasks in list.',
      selectAllInListPrefix: 'Select all ',
      selectAllInListSuffix: ' tasks in list',
      selectAllOnPage: 'Select all on this page',
      selectAllTasksInList: 'Select all tasks in list',
      tableTitle: 'Title',
      tablePriority: 'Priority',
      tableOwner: 'Owner',
      tableStatus: 'Status',
      tableDue: 'Due',
      tableTags: 'Tags',
      tableCreated: 'Created',
      tableActions: 'Actions',
      swipeHintAria: 'Task card. Swipe right to edit or left to delete.',
      metricsAria: 'Task due date summary',
      overdueSuffix: 'overdue',
      dueTodaySuffix: 'due today',
      dueThisWeekSuffix: 'due this week',
      focusToday: 'Focus today',
      focusTodayAria: 'Filter tasks due today',
      listPaginationAria: 'List pagination',
      previousPageAria: 'Previous page',
      previous: 'Previous',
      pagePrefix: 'Page',
      of: 'of',
      nextPageAria: 'Next page',
      next: 'Next',
      perPage: 'Per page',
      tasksPerPageAria: 'Tasks per page',
      showingPrefix: 'Showing',
      loadingMoreCards: 'Loading more tasks…',
    },
    reader: {
      title: 'View task',
      detailsAria: 'Task details (read-only)',
      titleLabel: 'Title',
      statusLabel: 'Status',
      descriptionLabel: 'Description',
      priorityLabel: 'Priority',
      tagsLabel: 'Tags',
      ownerLabel: 'Owner',
      dueLabel: 'Due',
      createdLabel: 'Created',
    },
  },
  modals: {
    cancel: 'Cancel',
    create: {
      title: 'Create a new task',
      saveCta: 'Create task',
      descriptionPlaceholder: 'Optional context or notes for this task',
      ownerPlaceholder: 'e.g. Caseworker A',
      tagsPlaceholder: 'e.g. evidence, hearing',
      dueLabel: 'Due date and time (DD-MM-YYYY, 12-hour)',
      duePlaceholder: 'DD-MM-YYYY HH:MM AM/PM',
      taskTitlePlaceholder: 'e.g. Review case bundle',
    },
    edit: {
      title: 'Edit task',
      saveCta: 'Save changes',
      descriptionPlaceholder: 'Optional context or notes',
      tagsPlaceholder: 'e.g. evidence, hearing',
      taskTitlePlaceholder: 'e.g. Review case bundle',
    },
    delete: {
      titleSingle: 'Delete task?',
      titleManyPrefix: 'Delete ',
      titleManySuffix: ' tasks?',
      bodySinglePending: 'This task is not marked as done. Are you sure you want to permanently delete it?',
      bodySingleDone: 'Are you sure you want to permanently delete this task?',
      bodyMany: 'Are you sure you want to permanently delete the following tasks?',
      bodyEmpty: 'No tasks to delete. They may have been deleted already.',
      deleteTask: 'Delete task',
      deleteTasks: 'Delete tasks',
      cancelDeleteAria: 'Cancel delete',
    },
  },
  help: {
    title: 'Help & guided tour',
    closeMenu: 'Close menu',
    sectionsAria: 'Help sections',
    tabs: {
      profile: 'Profile',
      settings: 'Settings',
      guide: 'Guide',
      checklist: 'Checklist',
      about: 'About',
    },
    guideTitle: 'Welcome to the task manager',
    guideStart: 'Start guided tour',
    guideSkip: 'Skip — don’t show on startup',
    guideBody1:
      'The guided tour uses on-screen hints next to each control (not a blocking popup), so you can tap and try things right away. The screen outside the current step is blurred until you finish or exit the tour.',
    guideBody2:
      'The checklist only lists actions you are allowed to perform: viewers see read-only steps, editors see full task workflows, and administrators also get tour steps for Users and Audit. Progress is saved on this device; open this panel any time with the menu button in the header.',
    checklistProgressSuffix: 'activities completed',
    checklistReset: 'Reset progress',
    sectionsOpen: 'Replay',
    settings: {
      themeTitle: 'Theme',
      themeDesc: 'Switch between light and dark mode for comfortable reading.',
      switchToDark: 'Switch to dark mode',
      switchToLight: 'Switch to light mode',
      textSizeTitle: 'Text size',
      textSizeDesc: 'Choose one of six text scales with quick visual steps.',
      textSizeScaleAria: 'Text size scale',
      densityTitle: 'Density',
      densityDesc: 'Use compact spacing to fit more content on small screens or web dashboards.',
      densityOptionsAria: 'Density options',
      densityComfortable: 'Comfortable',
      densityCompact: 'Compact',
      motionTitle: 'Motion',
      motionDesc: 'Reduce animation to improve accessibility, comfort, and battery usage.',
      motionOptionsAria: 'Motion options',
      motionSystem: 'System',
      motionReduced: 'Reduced',
      motionFull: 'Full',
      startupViewTitle: 'Startup view',
      startupViewDesc: 'Choose which view opens first, or remember your most recent view.',
      openAppIn: 'Open app in',
      startupRemember: 'Remember last used',
      startupCards: 'Cards',
      startupList: 'List',
      startupKanban: 'Kanban',
      defaultSortTitle: 'Default sort',
      defaultSortDesc: 'Set the default sort for tasks when the app opens.',
      sortBy: 'Sort by',
      sortByDue: 'Due date',
      sortByTitle: 'Title',
      sortByPriority: 'Priority',
      sortByOwner: 'Owner',
      sortByStatus: 'Status',
      sortByTags: 'Tags',
      sortByCreated: 'Created',
      direction: 'Direction',
      directionAsc: 'Ascending',
      directionDesc: 'Descending',
      restoreDefaultsTitle: 'Restore defaults',
      restoreDefaultsDesc: 'Reset all settings in this panel to recommended defaults.',
      restoreDefaultsCta: 'Restore defaults',
    },
    about: {
      versionAria: 'Application version',
      versionPrefix: 'Version',
      title: 'About this app',
      body:
        'Caseworker task manager is a demonstration app for capturing, prioritising, and tracking tasks with due dates, tags, and multiple views (summary cards, list, and kanban on larger screens). Web and mobile clients talk to a Go API backed by SQLite, PostgreSQL, MariaDB, or MongoDB.',
      dtsTitle: 'Digital Talent Scheme',
      dtsPrefix: 'The brief and spirit of this build come from the UK Ministry of Justice',
      dtsSuffix:
        '— an open technical exercise for a caseworker task system. HMCTS publishes the specification on GitHub for transparency and for candidates learning in the open.',
      dtsLinkLabel: 'Digital Talent Scheme developer challenge',
      developerTitle: 'Developer',
      developerPrefix: 'Built and maintained by',
      sourcePrefix: 'Source for this submission:',
      sourceSuffix: 'on GitHub.',
    },
  },
} as const

export type SupportedLocale = 'en-GB'
export type UICopy = typeof EN_GB_COPY

const CATALOGS: Record<SupportedLocale, UICopy> = {
  'en-GB': EN_GB_COPY,
}

let activeLocale: SupportedLocale = 'en-GB'

export function getLocale(): SupportedLocale {
  return activeLocale
}

export function setLocale(next: SupportedLocale): void {
  activeLocale = next
}

export function getCopy(locale: SupportedLocale = activeLocale): UICopy {
  return CATALOGS[locale]
}

export function taskSortChipLabel(key: SortKey): string {
  const s = getCopy().tasks.sort
  switch (key) {
    case 'due':
      return s.byDueDateTime
    case 'title':
      return s.byTitle
    case 'priority':
      return s.byPriority
    case 'owner':
      return s.byOwner
    case 'status':
      return s.byStatus
    case 'tags':
      return s.byTags
    case 'created':
      return s.byCreated
  }
}

// Keep the existing `UI_COPY.*` API while resolving through the active locale catalog.
export const UI_COPY: UICopy = new Proxy({} as UICopy, {
  get(_target, key) {
    return getCopy()[key as keyof UICopy]
  },
}) as UICopy
