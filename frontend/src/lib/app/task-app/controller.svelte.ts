import { tick } from 'svelte'
import type { Task, TaskPriority, TaskStatus } from '../../api'
import { Capacitor } from '@capacitor/core'
import { createTask, deleteTask, listTasks, updateTask, updateTaskStatus } from '../../api'
import { dueState as dueStateUtil } from '../../tasks/dueState'
import { parseDateTimeUK, toDateTimePickerValue } from '../../tasks/date'
import {
  mergeColumnIntoTasks as mergeColumnIntoTasksUtil,
  tasksForColumn as tasksForColumnUtil,
} from '../../tasks/kanban'
import { finalizeKanbanColumnDrop } from '../../tasks/kanbanFinalize'
import { dueAtIsoFromPicker, parseTagsInput, validateCreateTaskForm } from '../../tasks/taskForm'
import { STATUS_OPTIONS as STATUS_OPTIONS_META } from '../../tasks/taskMeta'
import { TOAST_EXIT_MS, type ListPageSize } from '../constants'
import { handleGlobalKeydown } from '../globalShortcuts'
import { refreshHealthState } from '../health'
import {
  applyDensity,
  applyFontSize,
  applyMotionPreference,
  applyTheme,
  loadTaskUiBootstrapFromStorage,
  persistTaskUiPreferences,
  setDefaultSortPreference,
  setStartupViewModePreference,
  systemPreferredTheme,
} from '../preferences'
import {
  buildVisibleTasks,
  computeListTasksDisplay,
  computeTotalListPages,
  hasActiveFilters as computeHasActiveFilters,
} from '../../tasks/visibleList'
import { taskDueCounts, uniqueSortedOwners, uniqueSortedTags } from '../../tasks/metrics'
import { toastDurationMs } from '../toasts'
import type {
  FontSize,
  MotionPreference,
  PriorityFilter,
  SortKey,
  StartupViewMode,
  StatusFilter,
  Theme,
  Toast,
  ToastType,
  UiDensity,
  ViewMode,
} from '../types'
import type { HelpTabId, OnboardingStepId } from '../onboarding/types'
import { CHECKLIST_STEP_IDS, tourStepsForLayout } from '../onboarding/definitions'
import {
  checklistProgress,
  isAutoHelpDismissed,
  loadChecklist,
  resetOnboardingStorage,
  saveChecklist,
  setAutoHelpDismissed,
} from '../onboarding/storage'
/**
 * Reactive task-manager shell state and actions.
 * Lives in a `.svelte.ts` module so runes stay coherent with Svelte 5 lifecycle.
 */
export class TaskAppController {
  tasks = $state<Task[]>([])
  loading = $state(false)
  healthStatus = $state<'ok' | 'degraded' | 'down' | 'unknown'>('unknown')
  healthMessage = $state('')

  toasts = $state<Toast[]>([])
  private nextToastId = 0

  viewMode = $state<ViewMode>('cards')
  isNarrow = $state(false)
  mobileSearchExpanded = $state(false)

  sortKey = $state<SortKey>('due')
  sortAscending = $state(true)

  listPageSize = $state<ListPageSize>(20)
  listPage = $state(1)

  theme = $state<Theme>('light')
  fontSize = $state<FontSize>('md')
  density = $state<UiDensity>('comfortable')
  motionPreference = $state<MotionPreference>('system')
  startupViewMode = $state<StartupViewMode>('remember')
  defaultSortKey = $state<SortKey>('due')
  defaultSortAscending = $state(true)

  searchTerm = $state('')
  debouncedSearchTerm = $state('')
  statusFilter = $state<StatusFilter>('all')
  priorityFilter = $state<PriorityFilter>('all')
  ownerFilter = $state('')
  tagFilters = $state<string[]>([])
  filterFrom = $state('')
  filterTo = $state('')
  showFilters = $state(false)

  createModalOpen = $state(false)
  editModalTaskId = $state<string | null>(null)
  editTitle = $state('')
  editDescription = $state('')
  editStatus = $state<TaskStatus>('todo')
  editPriority = $state<TaskPriority>('normal')
  editTagsInput = $state('')
  editModalFirstInput = $state<HTMLInputElement | null>(null)
  deleteModalTaskIds = $state<string[] | null>(null)
  selectedTaskIds = $state<Set<string>>(new Set())

  helpModalOpen = $state(false)
  helpActiveTab = $state<HelpTabId>('guide')
  tourRunning = $state(false)
  tourStepIndex = $state(0)
  checklist = $state<Record<OnboardingStepId, boolean>>(loadChecklist())

  title = $state('')
  description = $state('')
  status = $state<TaskStatus>('todo')
  priority = $state<TaskPriority>('normal')
  owner = $state('')
  tagsInput = $state('')
  dueDateTimeStr = $state('')
  modalFirstInput = $state<HTMLInputElement | null>(null)
  searchInput = $state<HTMLInputElement | null>(null)
  quickAddTitle = $state('')
  quickAddDateTimeStr = $state('')
  quickAddSubmitting = $state(false)

  readonly statusOptions: { value: TaskStatus; label: string }[] = [...STATUS_OPTIONS_META]

  hasActiveFilters = $derived(
    computeHasActiveFilters(
      this.statusFilter,
      this.priorityFilter,
      this.ownerFilter,
      this.tagFilters,
      this.filterFrom,
      this.filterTo,
    ),
  )

  allTags = $derived(uniqueSortedTags(this.tasks))
  uniqueOwners = $derived(uniqueSortedOwners(this.tasks))
  dueSummary = $derived(taskDueCounts(this.tasks, (t) => dueStateUtil(t)))

  visibleTasks = $derived(
    buildVisibleTasks(
      this.tasks,
      this.debouncedSearchTerm,
      this.statusFilter,
      this.priorityFilter,
      this.ownerFilter,
      this.tagFilters,
      this.filterFrom,
      this.filterTo,
      this.sortKey,
      this.sortAscending,
    ),
  )

  listTasksDisplay = $derived(
    computeListTasksDisplay(
      this.viewMode,
      this.isNarrow,
      this.visibleTasks,
      this.listPage,
      this.listPageSize,
    ),
  )

  totalListPages = $derived(
    computeTotalListPages(
      this.viewMode,
      this.isNarrow,
      this.visibleTasks.length,
      this.listPageSize,
    ),
  )

  listTaskCount = $derived(this.viewMode === 'list' ? this.listTasksDisplay.length : 0)

  tourSteps = $derived(tourStepsForLayout(this.isNarrow))

  checklistProgressState = $derived(checklistProgress(this.checklist, this.isNarrow))

  private tourAdvanceGeneration = 0
  private settingsTourStepIds = new Set<OnboardingStepId>([
    'theme',
    'text_size',
    'density',
    'motion',
    'startup_view',
    'restore_defaults',
  ])
  private helpPinnedBySettingsTour = false

  isSelectAllIndeterminate = $derived(
    this.viewMode === 'list' &&
      this.listTaskCount > 0 &&
      this.selectedTaskIds.size > 0 &&
      this.selectedTaskIds.size < this.listTaskCount,
  )

  allVisibleTasksSelected = $derived(
    this.viewMode === 'list' &&
      this.visibleTasks.length > 0 &&
      this.selectedTaskIds.size === this.visibleTasks.length,
  )

  constructor() {
    $effect(() => {
      if (this.isNarrow && this.viewMode !== 'cards') {
        this.viewMode = 'cards'
      }
    })

    $effect(() => {
      const term = this.searchTerm
      const handle = setTimeout(() => {
        this.debouncedSearchTerm = term
      }, 200)
      return () => clearTimeout(handle)
    })

    $effect(() => {
      if (this.viewMode === 'list' && !this.isNarrow && this.listPage > this.totalListPages) {
        this.listPage = this.totalListPages
      }
    })

    $effect(() => {
      if (this.viewMode !== 'list' && this.selectedTaskIds.size > 0) {
        this.selectedTaskIds = new Set()
      }
    })

    $effect(() => {
      if (this.viewMode === 'list' && !this.quickAddDateTimeStr?.trim()) {
        this.quickAddDateTimeStr = toDateTimePickerValue(new Date())
      }
    })

    $effect(() => {
      persistTaskUiPreferences({
        viewMode: this.viewMode,
        sortKey: this.sortKey,
        sortAscending: this.sortAscending,
        statusFilter: this.statusFilter,
        priorityFilter: this.priorityFilter,
        ownerFilter: this.ownerFilter,
        tagFilters: this.tagFilters,
        searchTerm: this.searchTerm,
        filterFrom: this.filterFrom,
        filterTo: this.filterTo,
        showFilters: this.showFilters,
      })
    })

    $effect(() => {
      saveChecklist(this.checklist)
    })

    $effect(() => {
      const term = this.debouncedSearchTerm.trim()
      if (term.length > 0) this.markOnboardingStep('search')
    })

    $effect(() => {
      const steps = this.tourSteps
      if (this.tourStepIndex >= steps.length && steps.length > 0) {
        this.tourStepIndex = steps.length - 1
      }
    })

    /** Invalid tour state would render a full-screen dimmer with no coach UI — never block the app. */
    $effect(() => {
      if (!this.tourRunning) return
      const steps = this.tourSteps
      if (
        steps.length === 0 ||
        this.tourStepIndex < 0 ||
        this.tourStepIndex >= steps.length ||
        !steps[this.tourStepIndex]
      ) {
        this.stopTour()
      }
    })

    /**
     * During settings-focused tour steps, keep Help open on the Settings tab so spotlight targets
     * exist and progression remains interaction-driven. When leaving those steps, close that panel.
     */
    $effect(() => {
      if (!this.tourRunning) {
        this.helpPinnedBySettingsTour = false
        return
      }
      const step = this.tourSteps[this.tourStepIndex]
      if (!step) return
      const needsSettingsPanel = this.settingsTourStepIds.has(step.id)
      if (needsSettingsPanel) {
        this.helpModalOpen = true
        this.helpActiveTab = 'settings'
        this.helpPinnedBySettingsTour = true
        return
      }
      if (this.helpPinnedBySettingsTour && this.helpModalOpen) {
        this.helpModalOpen = false
        this.helpPinnedBySettingsTour = false
      }
    })

    $effect(() => {
      if (!this.tourRunning) return
      const steps = tourStepsForLayout(this.isNarrow)
      const step = steps[this.tourStepIndex]
      if (!step?.interactive) return
      if (!this.checklist[step.id]) return
      this.tourAdvanceGeneration++
      const gen = this.tourAdvanceGeneration
      const stepId = step.id
      const handle = setTimeout(() => {
        if (gen !== this.tourAdvanceGeneration) return
        if (!this.tourRunning) return
        const now = tourStepsForLayout(this.isNarrow)[this.tourStepIndex]
        if (!now || now.id !== stepId || !this.checklist[stepId]) return
        this.nextTourStep()
      }, 520)
      return () => clearTimeout(handle)
    })

    /** Narrow: expanded search covers Create and Filter; collapse when those steps need the full toolbar. */
    $effect(() => {
      if (!this.tourRunning || !this.isNarrow) return
      const steps = tourStepsForLayout(this.isNarrow)
      const step = steps[this.tourStepIndex]
      if (!step) return
      const needsCompactToolbar: OnboardingStepId[] = ['toolbar', 'create_task', 'filters', 'card_swipe']
      if (!needsCompactToolbar.includes(step.id)) return
      this.mobileSearchExpanded = false
      void tick().then(() => this.searchInput?.blur())
    })
  }

  showToast(message: string, type: ToastType): void {
    const id = ++this.nextToastId
    const duration = toastDurationMs(type)
    const timeoutId = setTimeout(() => this.dismissToast(id), duration)
    this.toasts = [...this.toasts, { id, message, type, timeoutId }]
  }

  dismissToast(id: number): void {
    const t = this.toasts.find((x) => x.id === id)
    if (!t) return
    clearTimeout(t.timeoutId)
    this.toasts = this.toasts.map((x) => (x.id === id ? { ...x, exiting: true } : x))
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== id)
    }, TOAST_EXIT_MS)
  }

  private resetForm(): void {
    this.title = ''
    this.description = ''
    this.status = 'todo'
    this.priority = 'normal'
    this.owner = ''
    this.tagsInput = ''
    this.dueDateTimeStr = ''
  }

  openCreateModal(): void {
    this.resetForm()
    this.dueDateTimeStr = toDateTimePickerValue(new Date())
    this.priority = 'normal'
    this.createModalOpen = true
    tick().then(() => this.modalFirstInput?.focus())
  }

  closeCreateModal(): void {
    this.createModalOpen = false
  }

  /** Mobile: expanded search hides Create and Filter; avoid that during the read-only toolbar tour step. */
  expandMobileSearch(): void {
    if (this.tourRunning && this.isNarrow) {
      const step = tourStepsForLayout(this.isNarrow)[this.tourStepIndex]
      if (step?.id === 'toolbar') return
    }
    this.mobileSearchExpanded = true
  }

  collapseMobileSearch(): void {
    this.mobileSearchExpanded = false
  }

  openHelp(tab: HelpTabId = 'guide'): void {
    if (this.tourRunning) this.stopTour()
    this.helpModalOpen = true
    this.helpActiveTab = tab
  }

  closeHelp(): void {
    this.helpModalOpen = false
    this.tourRunning = false
    this.tourStepIndex = 0
  }

  setHelpTab(tab: HelpTabId): void {
    this.helpActiveTab = tab
  }

  startGuidedTour(): void {
    this.helpModalOpen = false
    this.helpActiveTab = 'guide'
    this.tourRunning = true
    this.tourStepIndex = 0
  }

  skipWelcomeForever(): void {
    setAutoHelpDismissed()
    this.closeHelp()
  }

  stopTour(): void {
    this.tourRunning = false
  }

  nextTourStep(): void {
    if (!this.tourRunning) return
    const steps = tourStepsForLayout(this.isNarrow)
    if (this.tourStepIndex >= steps.length - 1) {
      this.tourRunning = false
      setAutoHelpDismissed()
      this.showToast('Tour complete. Replay any time from Help → Sections.', 'notification')
      return
    }
    this.tourStepIndex++
  }

  prevTourStep(): void {
    if (this.tourStepIndex > 0) this.tourStepIndex--
  }

  markOnboardingStep(id: OnboardingStepId): void {
    if (!CHECKLIST_STEP_IDS.includes(id)) return
    if (this.checklist[id]) return
    this.checklist = { ...this.checklist, [id]: true }
  }

  replayTourFromStep(id: OnboardingStepId): void {
    const steps = tourStepsForLayout(this.isNarrow)
    const idx = steps.findIndex((s) => s.id === id)
    this.helpModalOpen = false
    this.helpActiveTab = 'guide'
    this.tourRunning = true
    this.tourStepIndex = idx >= 0 ? idx : 0
  }

  resetOnboardingProgress(): void {
    resetOnboardingStorage()
    this.checklist = loadChecklist()
    this.showToast('Tutorial progress cleared.', 'notification')
  }

  toggleFilters(): void {
    const next = !this.showFilters
    this.showFilters = next
    if (next) this.markOnboardingStep('filters')
  }

  openEditModal(task: Task): void {
    this.editModalTaskId = task.id
    this.editTitle = task.title
    this.editDescription = task.description ?? ''
    this.editStatus = task.status
    this.editPriority = (task.priority ?? 'normal') as TaskPriority
    this.editTagsInput = (task.tags ?? []).join(', ')
    tick().then(() => this.editModalFirstInput?.focus())
  }

  closeEditModal(): void {
    this.editModalTaskId = null
  }

  handleModalBackdropClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).classList.contains('modal-backdrop')) return
    if (this.helpModalOpen) {
      this.closeHelp()
      return
    }
    if (this.createModalOpen) this.closeCreateModal()
    if (this.editModalTaskId !== null) this.closeEditModal()
    if (this.deleteModalTaskIds !== null) this.closeDeleteModal()
  }

  openDeleteModal(taskId: string): void {
    this.deleteModalTaskIds = [taskId]
  }

  openBulkDeleteModal(): void {
    if (this.selectedTaskIds.size === 0) return
    this.deleteModalTaskIds = [...this.selectedTaskIds]
  }

  closeDeleteModal(): void {
    this.deleteModalTaskIds = null
  }

  async performDeleteTask(): Promise<void> {
    if (!this.deleteModalTaskIds?.length) return
    const ids = [...this.deleteModalTaskIds]
    this.closeDeleteModal()
    this.selectedTaskIds = new Set()
    let failed = 0
    for (const id of ids) {
      try {
        await deleteTask(id)
        this.tasks = this.tasks.filter((t) => t.id !== id)
      } catch (e) {
        failed++
        this.showToast(e instanceof Error ? e.message : 'Failed to delete task', 'error')
      }
    }
    if (failed === 0) {
      this.markOnboardingStep('delete_task')
      this.showToast(ids.length === 1 ? 'Task deleted.' : `${ids.length} tasks deleted.`, 'notification')
    }
  }

  toggleTaskSelection(id: string): void {
    const next = new Set(this.selectedTaskIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    this.selectedTaskIds = next
  }

  selectAllInList(): void {
    const rows = this.listTasksDisplay
    if (this.selectedTaskIds.size === rows.length) {
      this.selectedTaskIds = new Set()
    } else {
      this.selectedTaskIds = new Set(rows.map((t) => t.id))
    }
  }

  selectAllInListView(): void {
    this.selectedTaskIds = new Set(this.visibleTasks.map((t) => t.id))
  }

  async bulkSetStatus(newStatus: TaskStatus): Promise<void> {
    if (this.selectedTaskIds.size === 0) return
    const ids = [...this.selectedTaskIds]
    try {
      await Promise.all(ids.map((id) => updateTaskStatus(id, { status: newStatus })))
      this.tasks = this.tasks.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t))
      this.selectedTaskIds = new Set()
      this.showToast(
        ids.length === 1 ? 'Status updated.' : `Status updated for ${ids.length} tasks.`,
        'notification',
      )
    } catch (e) {
      this.showToast(e instanceof Error ? e.message : 'Failed to update status', 'error')
    }
  }

  clearListSelection(): void {
    this.selectedTaskIds = new Set()
  }

  handleResize(): void {
    const width = window.innerWidth || document.documentElement.clientWidth || 0
    this.isNarrow = width <= 640
    if (!this.isNarrow) this.mobileSearchExpanded = false
  }

  clearAllFilters(): void {
    this.statusFilter = 'all'
    this.priorityFilter = 'all'
    this.ownerFilter = ''
    this.tagFilters = []
    this.filterFrom = ''
    this.filterTo = ''
    this.showFilters = true
  }

  filterByTag(tag: string): void {
    const trimmed = tag.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (this.tagFilters.some((t) => t.toLowerCase() === lower)) return
    this.tagFilters = [...this.tagFilters, trimmed]
    this.showFilters = true
  }

  async loadTasks(): Promise<void> {
    this.loading = true
    try {
      this.tasks = await listTasks()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load tasks'
      this.showToast(msg, 'error')
      this.healthStatus = 'down'
      this.healthMessage = msg
    } finally {
      this.loading = false
    }
  }

  setTheme(next: Theme): void {
    this.theme = next
    applyTheme(this.theme, true)
    this.markOnboardingStep('theme')
  }

  setFontSize(next: FontSize): void {
    this.fontSize = next
    applyFontSize(this.fontSize)
    this.markOnboardingStep('text_size')
  }

  setDensity(next: UiDensity): void {
    this.density = next
    applyDensity(next)
    this.markOnboardingStep('density')
  }

  setMotionPreference(next: MotionPreference): void {
    this.motionPreference = next
    applyMotionPreference(next)
    this.markOnboardingStep('motion')
  }

  setStartupViewMode(next: StartupViewMode): void {
    this.startupViewMode = next
    setStartupViewModePreference(next)
    this.markOnboardingStep('startup_view')
  }

  setDefaultSort(nextSortKey: SortKey, nextSortAscending: boolean): void {
    this.defaultSortKey = nextSortKey
    this.defaultSortAscending = nextSortAscending
    setDefaultSortPreference(nextSortKey, nextSortAscending)
    this.sortKey = nextSortKey
    this.sortAscending = nextSortAscending
  }

  restoreDefaultSettings(): void {
    this.theme = 'light'
    this.fontSize = 'md'
    this.density = 'comfortable'
    this.motionPreference = 'system'
    this.startupViewMode = 'remember'
    this.defaultSortKey = 'due'
    this.defaultSortAscending = true
    this.viewMode = 'cards'
    this.sortKey = 'due'
    this.sortAscending = true

    applyTheme(this.theme, true)
    applyFontSize(this.fontSize)
    applyDensity(this.density)
    applyMotionPreference(this.motionPreference)
    setStartupViewModePreference(this.startupViewMode)
    setDefaultSortPreference(this.defaultSortKey, this.defaultSortAscending)

    this.markOnboardingStep('restore_defaults')
    this.showToast('Settings restored to defaults.', 'notification')
  }

  setViewModeFromUi(next: ViewMode): void {
    this.viewMode = next
    if (!this.isNarrow) this.markOnboardingStep('view_modes')
  }

  onGlobalKeydown(event: KeyboardEvent): void {
    handleGlobalKeydown(event, {
      tourRunning: this.tourRunning,
      helpModalOpen: this.helpModalOpen,
      createModalOpen: this.createModalOpen,
      editModalTaskId: this.editModalTaskId,
      deleteModalTaskIds: this.deleteModalTaskIds,
      searchInput: this.searchInput,
      stopTour: () => this.stopTour(),
      closeHelp: () => this.closeHelp(),
      closeCreateModal: () => this.closeCreateModal(),
      closeEditModal: () => this.closeEditModal(),
      closeDeleteModal: () => this.closeDeleteModal(),
      openCreateModal: () => this.openCreateModal(),
      setViewMode: (m) => {
        this.setViewModeFromUi(m)
      },
    })
  }

  async handleQuickAdd(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const titleTrim = this.quickAddTitle.trim()
    if (!titleTrim) {
      this.showToast('Enter a title for the task.', 'warning')
      return
    }
    const dueAtISO = dueAtIsoFromPicker(this.quickAddDateTimeStr, parseDateTimeUK)
    if (!dueAtISO) {
      this.showToast('Enter a valid due date and time using the picker.', 'warning')
      return
    }
    if (new Date(dueAtISO).getTime() < Date.now()) {
      this.showToast('Due date/time must be in the future.', 'warning')
      return
    }
    this.quickAddSubmitting = true
    try {
      const created = await createTask({
        title: titleTrim,
        status: 'todo',
        priority: 'normal',
        dueAt: dueAtISO,
      })
      this.tasks = [...this.tasks, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      this.quickAddTitle = ''
      this.quickAddDateTimeStr = ''
      this.markOnboardingStep('create_task')
      this.showToast('Task created.', 'notification')
    } catch (e) {
      this.showToast(e instanceof Error ? e.message : 'Failed to create task', 'error')
    } finally {
      this.quickAddSubmitting = false
    }
  }

  async handleCreateTask(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const validationError = validateCreateTaskForm(this.title, this.dueDateTimeStr, parseDateTimeUK)
    if (validationError) {
      this.showToast(validationError, 'warning')
      return
    }

    const dueAtISO = dueAtIsoFromPicker(this.dueDateTimeStr, parseDateTimeUK)
    if (!dueAtISO) return

    const tagList = parseTagsInput(this.tagsInput)
    try {
      const payload = {
        title: this.title.trim(),
        description: this.description.trim() ? this.description.trim() : null,
        status: this.status,
        priority: this.priority || 'normal',
        owner: this.owner.trim() || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
        dueAt: dueAtISO,
      }
      const created = await createTask(payload)
      this.tasks = [...this.tasks, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      this.closeCreateModal()
      this.markOnboardingStep('create_task')
      this.showToast('Task created.', 'notification')
    } catch (e) {
      this.showToast(e instanceof Error ? e.message : 'Failed to create task', 'error')
    }
  }

  async handleEditTask(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (this.editModalTaskId == null) return
    if (!this.editTitle.trim()) {
      this.showToast('Title is required.', 'warning')
      return
    }
    const tagList = parseTagsInput(this.editTagsInput)
    try {
      const updated = await updateTask(this.editModalTaskId, {
        title: this.editTitle.trim(),
        description: this.editDescription.trim() || null,
        status: this.editStatus,
        priority: this.editPriority || 'normal',
        tags: tagList,
      })
      const id = this.editModalTaskId
      this.tasks = this.tasks.map((t) => (t.id === id ? updated : t))
      this.closeEditModal()
      this.markOnboardingStep('edit_task')
      this.showToast('Task updated.', 'notification')
    } catch (e) {
      this.showToast(e instanceof Error ? e.message : 'Failed to update task', 'error')
    }
  }

  handleDeleteTask(taskId: string): void {
    this.openDeleteModal(taskId)
  }

  tasksForColumn(status: TaskStatus): Task[] {
    return tasksForColumnUtil(this.visibleTasks, status)
  }

  mergeColumnIntoTasks(status: TaskStatus, items: Task[]): void {
    this.tasks = mergeColumnIntoTasksUtil(this.tasks, status, items)
  }

  handleKanbanConsider(status: TaskStatus, e: CustomEvent<{ items: Task[] }>): void {
    this.mergeColumnIntoTasks(status, e.detail.items as Task[])
  }

  async handleKanbanFinalize(status: TaskStatus, e: CustomEvent<{ items: Task[] }>): Promise<void> {
    await finalizeKanbanColumnDrop({
      status,
      items: e.detail.items as Task[],
      tasks: this.tasks,
      setTasks: (next) => {
        this.tasks = next
      },
      updateTaskStatus,
      showToast: (m, t) => this.showToast(m, t),
    })
  }

  async refreshHealth(): Promise<void> {
    const res = await refreshHealthState()
    this.healthStatus = res.healthStatus
    this.healthMessage = res.healthMessage
  }

  /** Call from `onMount` of the shell component. */
  bootstrap(): void {
    this.handleResize()
    const boot = loadTaskUiBootstrapFromStorage()
    if (boot.theme) {
      this.theme = boot.theme
    } else {
      const mobileOrNative = this.isNarrow || Capacitor.isNativePlatform()
      this.theme = mobileOrNative ? systemPreferredTheme() : 'light'
    }
    if (boot.fontSize) this.fontSize = boot.fontSize
    if (boot.density) this.density = boot.density
    if (boot.motionPreference) this.motionPreference = boot.motionPreference
    if (boot.startupViewMode) this.startupViewMode = boot.startupViewMode
    if (boot.defaultSortKey) this.defaultSortKey = boot.defaultSortKey
    if (boot.defaultSortAscending !== undefined) this.defaultSortAscending = boot.defaultSortAscending

    this.sortKey = this.defaultSortKey
    this.sortAscending = this.defaultSortAscending
    if (boot.sortKey) this.sortKey = boot.sortKey
    if (boot.sortAscending !== undefined) this.sortAscending = boot.sortAscending
    if (boot.statusFilter) this.statusFilter = boot.statusFilter
    if (boot.priorityFilter) this.priorityFilter = boot.priorityFilter
    if (boot.ownerFilter !== undefined) this.ownerFilter = boot.ownerFilter
    if (boot.tagFilters !== undefined) this.tagFilters = [...boot.tagFilters]
    if (boot.searchTerm !== undefined) this.searchTerm = boot.searchTerm
    if (boot.debouncedSearchTerm !== undefined) this.debouncedSearchTerm = boot.debouncedSearchTerm
    if (boot.filterFrom !== undefined) this.filterFrom = boot.filterFrom
    if (boot.filterTo !== undefined) this.filterTo = boot.filterTo
    if (boot.showFilters !== undefined) this.showFilters = boot.showFilters
    if (boot.viewMode) this.viewMode = boot.viewMode
    if (this.startupViewMode !== 'remember') this.viewMode = this.startupViewMode

    applyTheme(this.theme, Boolean(boot.theme))
    applyFontSize(this.fontSize)
    applyDensity(this.density)
    applyMotionPreference(this.motionPreference)
    void this.refreshHealth()
    void this.loadTasks()

    void tick().then(() => {
      if (!isAutoHelpDismissed()) {
        this.helpModalOpen = true
        this.helpActiveTab = 'guide'
      }
    })
  }
}
