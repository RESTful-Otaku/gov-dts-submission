import { tick } from 'svelte'
import type {
  AuditLog,
  AuditLogsSortField,
  AuthUser,
  Task,
  TaskPriority,
  TaskStatus,
  UserRole,
  UsersSortField,
} from '../../api'
import { Capacitor } from '@capacitor/core'
import { resolveBootstrapState, toPersistedTaskUiState } from './bootstrapState'
import {
  ApiError,
  apiErrorMessage,
  createTask,
  deleteTask,
  deleteUser,
  listAuditLogs,
  listTasks,
  listUserDisplayNames,
  listUsers,
  login,
  logout,
  me,
  recoverPassword,
  register,
  requestUserPasswordReset,
  resetPassword,
  updateTask,
  updateTaskStatus,
  updateUser,
} from '../../api'
import {
  nextAutoAdvanceStepId,
  shouldExecuteAutoAdvance,
  TOUR_AUTO_ADVANCE_DELAY_MS,
} from './tourAutoAdvance'
import {
  currentTourStepId,
  helpTabForPinnedSettingsStep,
  isInvalidTourState,
  nextAutoViewModeForTourStep,
  shouldCollapseMobileSearchForTourStep,
  shouldCompleteListMultiSelectStep,
  shouldKeepHelpPinnedForSettingsStep,
  shouldSeedBulkDeleteSelection,
} from './onboardingRules'
import { dueState as dueStateUtil } from '../../tasks/dueState'
import { formatDueFilterChipDate, formatUKDateString, parseDateTimeUK, toDateTimePickerValue } from '../../tasks/date'
import {
  mergeColumnIntoTasks as mergeColumnIntoTasksUtil,
  tasksForColumn as tasksForColumnUtil,
} from '../../tasks/kanban'
import { finalizeKanbanColumnDrop } from '../../tasks/kanbanFinalize'
import { dueAtIsoFromPicker, parseTagsInput, validateCreateTaskForm } from '../../tasks/taskForm'
import { STATUS_OPTIONS as STATUS_OPTIONS_META } from '../../tasks/taskMeta'
import { ADMIN_UI_MIN_WIDTH_PX, TOAST_EXIT_MS, type ListPageSize } from '../constants'
import {
  emailFieldOk,
  nonEmptyOk,
  passwordStrengthOk,
  passwordsMatchOk,
  taskTitleOk,
} from '../authFieldValidation'
import { handleGlobalKeydown } from '../globalShortcuts'
import { refreshHealthState } from '../health'
import { UI_MESSAGES, deletedForCount, statusUpdatedForCount } from '../messages'
import {
  applyDensity,
  applyFontSize,
  applyMotionPreference,
  applyTheme,
  loadTaskUiBootstrapFromStorage,
  persistTaskUiPreferences,
  setDefaultSortPreference,
  loadSavedViewsFromStorage,
  persistSavedViewsToStorage,
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
import { isTaskSpotlightStep } from './tourStepHelpers'
import { computeStickyChromeCollapsed } from './stickyChrome'
import { UI_COPY, taskSortChipLabel } from '../copy'
import { assertInvariant } from '../invariant'
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
  TaskSavedView,
  ActiveFilterChip,
  ActiveFilterChipKind,
} from '../types'
import type { HelpTabId, OnboardingStepId } from '../onboarding/types'
import { CHECKLIST_STEP_IDS, tourStepsForRoleAndLayout } from '../onboarding/definitions'
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
  private emptyAuthErrors(): Record<
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'username'
    | 'password'
    | 'passwordConfirm'
    | 'resetToken'
    | 'newPassword'
    | 'recoverEmail'
    | 'form',
    string
  > {
    return {
      email: '',
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      passwordConfirm: '',
      resetToken: '',
      newPassword: '',
      recoverEmail: '',
      form: '',
    }
  }
  tasks = $state<Task[]>([])
  loading = $state(false)
  healthStatus = $state<'ok' | 'degraded' | 'down' | 'unknown'>('unknown')
  healthMessage = $state('')

  toasts = $state<Toast[]>([])
  private nextToastId = 0

  viewMode = $state<ViewMode>('cards')
  isNarrow = $state(false)
  viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : ADMIN_UI_MIN_WIDTH_PX)
  mobileSearchExpanded = $state(false)
  /** GOV.UK/title row hidden past scroll threshold; only shows again near top (see applyStickyChromeFromScroll). */
  stickyChromeCollapsed = $state(false)
  private stickyChromeLastY = 0
  private stickyChromeScrollRaf = 0

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
  editFieldBlurred = $state<Record<'title' | 'due', boolean>>({ title: false, due: false })
  deleteModalTaskIds = $state<string[] | null>(null)
  selectedTaskIds = $state<Set<string>>(new Set())

  helpModalOpen = $state(false)
  helpActiveTab = $state<HelpTabId>('profile')
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
  createFieldBlurred = $state<Record<'title' | 'due', boolean>>({ title: false, due: false })
  searchInput = $state<HTMLInputElement | null>(null)
  quickAddTitle = $state('')
  quickAddDateTimeStr = $state('')
  quickAddSubmitting = $state(false)
  savedViews = $state<TaskSavedView[]>([])
  selectedSavedViewId = $state('')
  activeMainTab = $state<'tasks' | 'users' | 'audit'>('tasks')
  /** Display names (usernames) for task owner picker; HTTP only. */
  assignableDisplayNames = $state<string[]>([])
  /**
   * When false, the next time the viewport qualifies for admin UI we refetch users/audit.
   * Cleared when the shell is too narrow or the user signs out.
   */
  private adminShellDataSynced = false
  currentUser = $state<AuthUser | null>(null)
  users = $state<AuthUser[]>([])
  usersTotal = $state(0)
  usersLoading = $state(false)
  usersSearchTerm = $state('')
  usersDebouncedSearch = $state('')
  usersRoleFilter = $state<'' | UserRole>('')
  usersSortKey = $state<UsersSortField>('created_at')
  usersSortAscending = $state(false)
  usersPage = $state(1)
  usersPageSize = $state<ListPageSize>(20)
  showUsersFilters = $state(false)
  selectedUserIds = $state<Set<string>>(new Set())
  editUserTarget = $state<AuthUser | null>(null)
  editUserFirstName = $state('')
  editUserLastName = $state('')
  editUserUsername = $state('')
  editUserModalFirstInput = $state<HTMLInputElement | null>(null)
  deleteUserModalIds = $state<string[] | null>(null)
  auditLogs = $state<AuditLog[]>([])
  auditQuery = $state('')
  auditUserId = $state('')
  /** When set, passed as ?field= to API (filters rows whose changed_fields JSON includes this key). */
  auditChangedField = $state('')
  auditSort = $state<AuditLogsSortField>('created_at')
  auditOrder = $state<'asc' | 'desc'>('desc')
  authEmail = $state('')
  authFirstName = $state('')
  authLastName = $state('')
  authUsername = $state('')
  authPassword = $state('')
  authPasswordConfirm = $state('')
  authShowPassword = $state(false)
  authRecoverEmail = $state('')
  /** Auth card on the gate: main sign-in vs password recovery. */
  authGateSubview = $state<'signin' | 'recover'>('signin')
  authFieldBlurred = $state<Record<string, boolean>>({})
  authMode = $state<'login' | 'register'>('login')
  authResetMode = $state<'none' | 'request' | 'confirm'>('none')
  authResetToken = $state('')
  authNewPassword = $state('')
  authErrors = $state<
    Record<
      | 'email'
      | 'firstName'
      | 'lastName'
      | 'username'
      | 'password'
      | 'passwordConfirm'
      | 'resetToken'
      | 'newPassword'
      | 'recoverEmail'
      | 'form',
      string
    >
  >(this.emptyAuthErrors())
  oauthStatus = $state('')

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

  activeFilterChips = $derived.by((): ActiveFilterChip[] => {
    const chips: ActiveFilterChip[] = []
    const trimmedSearch = this.searchTerm.trim()
    if (trimmedSearch) {
      chips.push({ id: 'search', kind: 'search', label: `${UI_COPY.tasks.chipSearchPrefix}: ${trimmedSearch}` })
    }
    if (this.statusFilter !== 'all') {
      const statusLabel = this.statusOptions.find((opt) => opt.value === this.statusFilter)?.label ?? this.statusFilter
      chips.push({ id: 'status', kind: 'status', label: `${UI_COPY.tasks.chipStatusPrefix}: ${statusLabel}` })
    }
    if (this.priorityFilter !== 'all') {
      const priorityLabel =
        this.priorityFilter === 'urgent'
          ? 'Urgent'
          : this.priorityFilter === 'high'
            ? 'High'
            : this.priorityFilter === 'normal'
              ? 'Normal'
              : 'Low'
      chips.push({ id: 'priority', kind: 'priority', label: `${UI_COPY.tasks.chipPriorityPrefix}: ${priorityLabel}` })
    }
    const owner = this.ownerFilter.trim()
    if (owner) chips.push({ id: 'owner', kind: 'owner', label: `${UI_COPY.tasks.chipOwnerPrefix}: ${owner}` })
    for (const tag of this.tagFilters) {
      chips.push({ id: `tag:${tag.toLowerCase()}`, kind: 'tag', label: `${UI_COPY.tasks.chipTagPrefix}: ${tag}` })
    }
    if (this.filterFrom) {
      chips.push({
        id: 'from',
        kind: 'from',
        label: `${UI_COPY.tasks.chipDueFromPrefix}: ${formatDueFilterChipDate(this.filterFrom)}`,
      })
    }
    if (this.filterTo) {
      chips.push({
        id: 'to',
        kind: 'to',
        label: `${UI_COPY.tasks.chipDueToPrefix}: ${formatDueFilterChipDate(this.filterTo)}`,
      })
    }
    if (this.sortKey !== this.defaultSortKey || this.sortAscending !== this.defaultSortAscending) {
      const sortLabel = taskSortChipLabel(this.sortKey)
      chips.push({
        id: 'sort',
        kind: 'sort',
        label: `${UI_COPY.tasks.chipSortPrefix}: ${sortLabel} (${this.sortAscending ? UI_COPY.tasks.sort.ascShort : UI_COPY.tasks.sort.descShort})`,
      })
    }
    return chips
  })

  tourSteps = $derived(tourStepsForRoleAndLayout(this.isNarrow, this.currentUser?.role ?? null))

  checklistProgressState = $derived(
    checklistProgress(this.checklist, this.isNarrow, this.currentUser?.role ?? null),
  )

  totalUserPages = $derived(Math.max(1, Math.ceil(this.usersTotal / this.usersPageSize) || 1))

  /** Current tour step id when the tour is running (for per-card / per-control spotlights). */
  tourSpotlightStepId = $derived(
    this.tourRunning ? (this.tourSteps[this.tourStepIndex]?.id ?? null) : null,
  )

  /** First visible task used as the onboarding anchor for card/list/kanban highlights. */
  tourAnchorTaskId = $derived.by(() => {
    const id = this.tourSpotlightStepId
    if (isTaskSpotlightStep(id)) {
      return this.visibleTasks[0]?.id ?? null
    }
    return null
  })

  private tourAdvanceGeneration = 0
  private readonly deleteUndoWindowMs = 4500
  private readonly userDeleteUndoWindowMs = 10000
  private readonly serverTaskQueryEnabled = import.meta.env.VITE_SERVER_TASK_QUERY === 'true'
  private readonly authRequired = import.meta.env.MODE === 'test' ? false : import.meta.env.VITE_AUTH_REQUIRED !== 'false'
  private listQueryRequestSeq = 0
  /** Baseline `sortKey|sortAscending` when entering the filter sort tour step (detect first change). */
  private filterSortTourBaseline: string | null = null
  /** Last wide tour step that auto-switched view mode (one shot per step id). */
  private tourViewModeAutoForStep: OnboardingStepId | null = null
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
      const term = this.usersSearchTerm
      const handle = setTimeout(() => {
        this.usersDebouncedSearch = term
      }, 200)
      return () => clearTimeout(handle)
    })

    $effect(() => {
      if (!this.isAdmin || this.activeMainTab !== 'users') return
      this.usersDebouncedSearch
      this.usersRoleFilter
      this.usersSortKey
      this.usersSortAscending
      this.usersPage
      this.usersPageSize
      void this.loadUsers()
    })

    $effect(() => {
      if (!this.isAdmin) return
      const maxP = this.totalUserPages
      if (this.usersPage > maxP) this.usersPage = maxP
    })

    $effect(() => {
      if (!this.shouldUseServerTaskQuery()) return
      // Depend on current query knobs; state persistence already debounces search.
      this.debouncedSearchTerm
      this.statusFilter
      this.priorityFilter
      this.ownerFilter
      this.tagFilters
      this.sortKey
      this.sortAscending
      void this.loadTasks()
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
      persistTaskUiPreferences(
        toPersistedTaskUiState({
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
        }),
      )
    })

    $effect(() => {
      saveChecklist(this.checklist)
    })

    $effect(() => {
      persistSavedViewsToStorage(this.savedViews)
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
      if (isInvalidTourState(this.tourRunning, steps, this.tourStepIndex)) {
        this.stopTour()
      }
    })

    /**
     * During settings-focused tour steps, keep Help open on the Settings tab so spotlight targets
     * exist and progression remains interaction-driven. When leaving those steps, close that panel.
     */
    $effect(() => {
      const stepId = currentTourStepId(this.tourSteps, this.tourStepIndex)
      if (!this.tourRunning) {
        this.helpPinnedBySettingsTour = false
        return
      }
      if (shouldKeepHelpPinnedForSettingsStep(this.tourRunning, stepId)) {
        this.helpModalOpen = true
        this.helpActiveTab = helpTabForPinnedSettingsStep()
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
      const steps = this.tourSteps
      const step = steps[this.tourStepIndex]
      const stepId = nextAutoAdvanceStepId(this.tourRunning, step, this.checklist)
      if (!stepId) return
      this.tourAdvanceGeneration++
      const gen = this.tourAdvanceGeneration
      const handle = setTimeout(() => {
        if (
          !shouldExecuteAutoAdvance({
            generationAtSchedule: gen,
            currentGeneration: this.tourAdvanceGeneration,
            tourRunning: this.tourRunning,
            steps: this.tourSteps,
            stepIndex: this.tourStepIndex,
            expectedStepId: stepId,
            checklist: this.checklist,
          })
        ) {
          return
        }
        this.nextTourStep()
      }, TOUR_AUTO_ADVANCE_DELAY_MS)
      return () => clearTimeout(handle)
    })

    /** Narrow: expanded search covers Create and Filter; collapse when those steps need the full toolbar. */
    $effect(() => {
      if (!this.tourRunning || !this.isNarrow) return
      const steps = this.tourSteps
      const step = steps[this.tourStepIndex]
      if (!step) return
      if (!shouldCollapseMobileSearchForTourStep(this.tourRunning, this.isNarrow, step.id)) return
      this.mobileSearchExpanded = false
      void tick().then(() => this.searchInput?.blur())
    })

    /** Wide: sort demo needs the filters panel open so the sort row is in the DOM. */
    $effect(() => {
      if (!this.tourRunning) return
      if (this.tourSteps[this.tourStepIndex]?.id === 'filter_sort_demo') {
        this.showFilters = true
      }
    })

    /** Wide: complete sort demo when the user changes sort field or direction. */
    $effect(() => {
      const step = this.tourRunning ? this.tourSteps[this.tourStepIndex]?.id : null
      const sig = `${this.sortKey}|${this.sortAscending}`
      if (step !== 'filter_sort_demo') {
        this.filterSortTourBaseline = null
        return
      }
      if (this.filterSortTourBaseline === null) {
        this.filterSortTourBaseline = sig
        return
      }
      if (sig !== this.filterSortTourBaseline) {
        this.markOnboardingStep('filter_sort_demo')
      }
    })

    /** Wide list: multi-select step completes when at least one row is selected. */
    $effect(() => {
      const stepId = currentTourStepId(this.tourSteps, this.tourStepIndex)
      if (
        shouldCompleteListMultiSelectStep(
          this.tourRunning,
          stepId,
          this.viewMode,
          this.selectedTaskIds.size,
        )
      ) {
        this.markOnboardingStep('list_multiselect')
      }
    })

    /** Wide list: bulk-delete step needs a selection so the toolbar (and spotlight target) exists. */
    $effect(() => {
      const stepId = currentTourStepId(this.tourSteps, this.tourStepIndex)
      if (
        shouldSeedBulkDeleteSelection(
          this.tourRunning,
          stepId,
          this.viewMode,
          this.visibleTasks.length,
          this.selectedTaskIds.size,
        )
      ) {
        this.selectedTaskIds = new Set([this.visibleTasks[0].id])
      }
    })

    /** Wide: jump to the view each list/kanban tour step is about (one layout change per step). */
    $effect(() => {
      const stepId = currentTourStepId(this.tourSteps, this.tourStepIndex)
      const next = nextAutoViewModeForTourStep(
        this.tourRunning,
        this.isNarrow,
        stepId,
        this.tourViewModeAutoForStep,
      )
      this.tourViewModeAutoForStep = next.nextStepId
      if (next.viewMode) this.viewMode = next.viewMode
    })
  }

  showToast(
    message: string,
    type: ToastType,
    options?: {
      actionLabel?: string
      onAction?: () => void
      durationMs?: number
      countdownFromSeconds?: number
    },
  ): number {
    const id = ++this.nextToastId
    const duration = options?.durationMs ?? toastDurationMs(type)
    const timeoutId = setTimeout(() => this.dismissToast(id), duration)
    let countdownIntervalId: ReturnType<typeof setInterval> | number | undefined
    const countdownFromSeconds = options?.countdownFromSeconds
    if (typeof countdownFromSeconds === 'number' && countdownFromSeconds > 0) {
      countdownIntervalId = setInterval(() => {
        this.toasts = this.toasts.map((t) => {
          if (t.id !== id || typeof t.countdownSeconds !== 'number') return t
          return { ...t, countdownSeconds: Math.max(0, t.countdownSeconds - 1) }
        })
      }, 1000)
    }
    this.toasts = [
      ...this.toasts,
      {
        id,
        message,
        type,
        timeoutId,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        countdownSeconds: countdownFromSeconds,
        countdownIntervalId,
      },
    ]
    return id
  }

  dismissToast(id: number): void {
    const t = this.toasts.find((x) => x.id === id)
    if (!t) return
    clearTimeout(t.timeoutId)
    if (t.countdownIntervalId) clearInterval(t.countdownIntervalId)
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
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to create tasks.', 'warning')
      return
    }
    this.createFieldBlurred = { title: false, due: false }
    this.resetForm()
    this.owner = this.currentUser?.username ?? ''
    this.dueDateTimeStr = toDateTimePickerValue(new Date())
    this.priority = 'normal'
    this.createModalOpen = true
    void this.loadAssignableDisplayNames()
    tick().then(() => this.modalFirstInput?.focus())
  }

  closeCreateModal(): void {
    this.createModalOpen = false
  }

  /** Mobile: expanded search hides Create and Filter; avoid that when the tour needs those controls. */
  expandMobileSearch(): void {
    if (this.tourRunning && this.isNarrow) {
      const step = this.tourSteps[this.tourStepIndex]
      if (step && shouldCollapseMobileSearchForTourStep(this.tourRunning, this.isNarrow, step.id)) return
    }
    this.mobileSearchExpanded = true
  }

  collapseMobileSearch(): void {
    this.mobileSearchExpanded = false
    this.applyStickyChromeFromScroll(false)
  }

  openHelp(tab: HelpTabId = 'profile'): void {
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
    this.mobileSearchExpanded = false
    window.scrollTo({ top: 0, behavior: 'auto' })
    this.stickyChromeCollapsed = false
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
    const steps = this.tourSteps
    if (this.tourStepIndex >= steps.length - 1) {
      this.tourRunning = false
      setAutoHelpDismissed()
      this.showToast(UI_MESSAGES.tourComplete, 'notification')
      return
    }
    const nextIdx = this.tourStepIndex + 1
    const nextStep = steps[nextIdx]
    if (
      this.isNarrow &&
      nextStep &&
      shouldCollapseMobileSearchForTourStep(this.tourRunning, this.isNarrow, nextStep.id)
    ) {
      this.mobileSearchExpanded = false
      void tick().then(() => this.searchInput?.blur())
    }
    this.tourStepIndex++
  }

  prevTourStep(): void {
    if (this.tourStepIndex <= 0) return
    const prevIdx = this.tourStepIndex - 1
    const prevStep = this.tourSteps[prevIdx]
    if (
      this.isNarrow &&
      prevStep &&
      shouldCollapseMobileSearchForTourStep(this.tourRunning, this.isNarrow, prevStep.id)
    ) {
      this.mobileSearchExpanded = false
      void tick().then(() => this.searchInput?.blur())
    }
    this.tourStepIndex--
  }

  markOnboardingStep(id: OnboardingStepId): void {
    if (!CHECKLIST_STEP_IDS.includes(id)) return
    if (this.checklist[id]) return
    this.checklist = { ...this.checklist, [id]: true }
  }

  replayTourFromStep(id: OnboardingStepId): void {
    const steps = tourStepsForRoleAndLayout(this.isNarrow, this.currentUser?.role ?? null)
    const idx = steps.findIndex((s) => s.id === id)
    this.helpModalOpen = false
    this.helpActiveTab = 'guide'
    this.mobileSearchExpanded = false
    window.scrollTo({ top: 0, behavior: 'auto' })
    this.stickyChromeCollapsed = false
    this.tourRunning = true
    this.tourStepIndex = idx >= 0 ? idx : 0
  }

  resetOnboardingProgress(): void {
    resetOnboardingStorage()
    this.checklist = loadChecklist()
    this.showToast(UI_MESSAGES.tutorialProgressCleared, 'notification')
  }

  toggleFilters(): void {
    const next = !this.showFilters
    this.showFilters = next
    if (next) this.markOnboardingStep('filters')
  }

  openEditModal(task: Task): void {
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to edit tasks.', 'warning')
      return
    }
    this.editFieldBlurred = { title: false, due: false }
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
    if (this.editUserTarget !== null) this.closeEditUserModal()
    if (this.deleteUserModalIds !== null) this.closeDeleteUsersModal()
  }

  openDeleteModal(taskId: string): void {
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to delete tasks.', 'warning')
      return
    }
    this.deleteModalTaskIds = [taskId]
  }

  openBulkDeleteModal(): void {
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to delete tasks.', 'warning')
      return
    }
    if (this.selectedTaskIds.size === 0) return
    this.deleteModalTaskIds = [...this.selectedTaskIds]
    if (this.tourRunning && this.tourSteps[this.tourStepIndex]?.id === 'list_bulk_delete') {
      this.markOnboardingStep('list_bulk_delete')
    }
  }

  closeDeleteModal(): void {
    this.deleteModalTaskIds = null
  }

  async performDeleteTask(): Promise<void> {
    if (!this.canMutateTasks) return
    if (!this.deleteModalTaskIds?.length) return
    const ids = [...this.deleteModalTaskIds]
    const removedSet = new Set(ids)
    const snapshots = new Map(
      this.tasks
        .filter((t) => removedSet.has(t.id))
        .map((t) => [t.id, t]),
    )
    this.closeDeleteModal()
    this.selectedTaskIds = new Set()
    this.tasks = this.tasks.filter((t) => !removedSet.has(t.id))

    let cancelled = false
    let undoToastId = 0
    const commitTimer = setTimeout(async () => {
      if (cancelled) return
      const deletedIds: string[] = []
      for (const id of ids) {
        try {
          await deleteTask(id)
          deletedIds.push(id)
        } catch (e) {
          this.showToast(apiErrorMessage(e, UI_MESSAGES.failedDeleteTask), 'error')
        }
      }
      const deletedSet = new Set(deletedIds)
      const failedIds = ids.filter((id) => !deletedSet.has(id))
      if (failedIds.length > 0) {
        const existing = new Set(this.tasks.map((t) => t.id))
        const rollback = failedIds
          .map((id) => snapshots.get(id))
          .filter((t): t is Task => Boolean(t))
          .filter((t) => !existing.has(t.id))
        if (rollback.length > 0) this.tasks = [...rollback, ...this.tasks]
      }
      if (deletedIds.length > 0) {
        this.markOnboardingStep('delete_task')
        this.showToast(deletedForCount(deletedIds.length), 'notification')
        this.refreshTasksAfterMutationIfNeeded()
      }
      this.dismissToast(undoToastId)
    }, this.deleteUndoWindowMs)

    undoToastId = this.showToast(UI_MESSAGES.deletePendingUndo, 'warning', {
      actionLabel: UI_MESSAGES.undo,
      durationMs: this.deleteUndoWindowMs,
      countdownFromSeconds: Math.ceil(this.deleteUndoWindowMs / 1000),
      onAction: () => {
        if (cancelled) return
        cancelled = true
        clearTimeout(commitTimer)
        const existing = new Set(this.tasks.map((t) => t.id))
        const restore = ids
          .map((id) => snapshots.get(id))
          .filter((t): t is Task => Boolean(t))
          .filter((t) => !existing.has(t.id))
        if (restore.length > 0) this.tasks = [...restore, ...this.tasks]
        this.dismissToast(undoToastId)
      },
    })
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
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to change task status.', 'warning')
      return
    }
    if (this.selectedTaskIds.size === 0) return
    const ids = [...this.selectedTaskIds]
    const selected = new Set(ids)
    const previousStatus = new Map(
      this.tasks
        .filter((t) => selected.has(t.id))
        .map((t) => [t.id, t.status] as const),
    )
    this.tasks = this.tasks.map((t) => (selected.has(t.id) ? { ...t, status: newStatus } : t))
    this.selectedTaskIds = new Set()

    let cancelled = false
    let undoToastId = 0
    const commitTimer = setTimeout(async () => {
      if (cancelled) return
      const updatedIds: string[] = []
      for (const id of ids) {
        try {
          await updateTaskStatus(id, { status: newStatus })
          updatedIds.push(id)
        } catch (e) {
          this.showToast(apiErrorMessage(e, UI_MESSAGES.failedUpdateStatus), 'error')
        }
      }
      const updatedSet = new Set(updatedIds)
      const failedIds = ids.filter((id) => !updatedSet.has(id))
      if (failedIds.length > 0) {
        this.tasks = this.tasks.map((t) => {
          if (!failedIds.includes(t.id)) return t
          const prev = previousStatus.get(t.id)
          return prev ? { ...t, status: prev } : t
        })
      }
      if (updatedIds.length > 0) {
        this.showToast(statusUpdatedForCount(updatedIds.length), 'notification')
        this.refreshTasksAfterMutationIfNeeded()
      }
      this.dismissToast(undoToastId)
    }, this.deleteUndoWindowMs)

    undoToastId = this.showToast(UI_MESSAGES.statusPendingUndo, 'warning', {
      actionLabel: UI_MESSAGES.undo,
      durationMs: this.deleteUndoWindowMs,
      countdownFromSeconds: Math.ceil(this.deleteUndoWindowMs / 1000),
      onAction: () => {
        if (cancelled) return
        cancelled = true
        clearTimeout(commitTimer)
        this.tasks = this.tasks.map((t) => {
          const prev = previousStatus.get(t.id)
          return prev ? { ...t, status: prev } : t
        })
        this.dismissToast(undoToastId)
      },
    })
  }

  clearListSelection(): void {
    this.selectedTaskIds = new Set()
  }

  handleResize(): void {
    const width = window.innerWidth || document.documentElement.clientWidth || 0
    this.viewportWidth = width
    this.isNarrow = width <= 640
    if (!this.isNarrow) this.mobileSearchExpanded = false
    if (this.isAdmin && !this.adminShellReady) {
      this.adminShellDataSynced = false
    } else if (this.isAdmin && this.adminShellReady && !this.adminShellDataSynced) {
      void this.loadUsers()
      void this.loadAuditLogs()
      this.adminShellDataSynced = true
    }
    this.stickyChromeLastY = window.scrollY ?? document.documentElement.scrollTop ?? 0
    this.applyStickyChromeFromScroll(true)
  }

  /**
   * Hysteresis (no “scroll up to expand”): expand only near the top; collapse past a lower bound.
   * Between those Y values, state is unchanged while scrolling (`resolveBand` false) to avoid jitter.
   * On mount/resize (`resolveBand` true), pick a side from the midpoint for mid-page loads.
   */
  applyStickyChromeFromScroll(resolveBand = false): void {
    const y = window.scrollY ?? document.documentElement.scrollTop ?? 0
    this.stickyChromeLastY = y
    this.stickyChromeCollapsed = computeStickyChromeCollapsed(
      y,
      resolveBand,
      this.stickyChromeCollapsed,
      this.tourRunning,
    )
  }

  /** One read per frame while scrolling; keeps sticky chrome state in sync without event spam. */
  private scheduleStickyChromeScroll(): void {
    if (this.stickyChromeScrollRaf !== 0) return
    this.stickyChromeScrollRaf = requestAnimationFrame(() => {
      this.stickyChromeScrollRaf = 0
      this.applyStickyChromeFromScroll(false)
    })
  }

  scrollChromeToTop(): void {
    const instant =
      this.motionPreference === 'reduced' ||
      (this.motionPreference === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    window.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' })
  }

  /** Register in shell `onMount`; returns teardown. */
  attachStickyChromeScroll(): () => void {
    this.applyStickyChromeFromScroll(true)
    const onScroll = () => this.scheduleStickyChromeScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (this.stickyChromeScrollRaf !== 0) {
        cancelAnimationFrame(this.stickyChromeScrollRaf)
        this.stickyChromeScrollRaf = 0
      }
    }
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

  applyTodayWorkspace(): void {
    const today = formatUKDateString(new Date())
    this.filterFrom = today
    this.filterTo = today
    this.showFilters = true
    this.listPage = 1
  }

  removeActiveFilterChip(id: string, kind: ActiveFilterChipKind): void {
    if (kind === 'search') {
      this.searchTerm = ''
      this.debouncedSearchTerm = ''
      return
    }
    if (kind === 'status') {
      this.statusFilter = 'all'
      return
    }
    if (kind === 'priority') {
      this.priorityFilter = 'all'
      return
    }
    if (kind === 'owner') {
      this.ownerFilter = ''
      return
    }
    if (kind === 'tag') {
      const lowered = id.startsWith('tag:') ? id.slice(4) : ''
      this.tagFilters = this.tagFilters.filter((tag) => tag.toLowerCase() !== lowered)
      return
    }
    if (kind === 'from') {
      this.filterFrom = ''
      return
    }
    if (kind === 'to') {
      this.filterTo = ''
      return
    }
    this.sortKey = this.defaultSortKey
    this.sortAscending = this.defaultSortAscending
  }

  saveCurrentView(nameRaw: string): void {
    const name = nameRaw.trim()
    if (!name) {
      this.showToast(UI_MESSAGES.savedViewNameRequired, 'warning')
      return
    }
    const state = toPersistedTaskUiState({
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
    const idx = this.savedViews.findIndex((v) => v.name.toLowerCase() === name.toLowerCase())
    if (idx >= 0) {
      const existing = this.savedViews[idx]
      const next = [...this.savedViews]
      next[idx] = { ...existing, name, state }
      this.savedViews = next
      this.selectedSavedViewId = existing.id
      this.showToast(UI_MESSAGES.savedViewUpdated, 'notification')
      return
    }
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `saved-view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.savedViews = [...this.savedViews, { id, name, state }]
    this.selectedSavedViewId = id
    this.showToast(UI_MESSAGES.savedViewSaved, 'notification')
  }

  applySavedView(id: string): void {
    const picked = this.savedViews.find((v) => v.id === id)
    if (!picked) return
    const s = picked.state
    this.viewMode = s.viewMode
    this.sortKey = s.sortKey
    this.sortAscending = s.sortAscending
    this.statusFilter = s.statusFilter
    this.priorityFilter = s.priorityFilter
    this.ownerFilter = s.ownerFilter
    this.tagFilters = [...s.tagFilters]
    this.searchTerm = s.searchTerm
    this.debouncedSearchTerm = s.searchTerm
    this.filterFrom = s.filterFrom
    this.filterTo = s.filterTo
    this.showFilters = s.showFilters
    this.selectedSavedViewId = id
    this.showToast(UI_MESSAGES.savedViewApplied, 'notification')
  }

  deleteSavedView(id: string): void {
    const next = this.savedViews.filter((v) => v.id !== id)
    if (next.length === this.savedViews.length) return
    this.savedViews = next
    if (this.selectedSavedViewId === id) this.selectedSavedViewId = ''
    this.showToast(UI_MESSAGES.savedViewDeleted, 'notification')
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
    const requestSeq = ++this.listQueryRequestSeq
    try {
      const params = this.shouldUseServerTaskQuery()
        ? {
            limit: 200,
            offset: 0,
            q: this.debouncedSearchTerm.trim() || undefined,
            status: this.statusFilter === 'all' ? undefined : this.statusFilter,
            priority: this.priorityFilter === 'all' ? undefined : this.priorityFilter,
            owner: this.ownerFilter.trim() || undefined,
            tag: this.tagFilters[0]?.trim() || undefined,
            sort: this.sortKey,
            order: this.sortAscending ? ('asc' as const) : ('desc' as const),
          }
        : { limit: 200, offset: 0 }
      const next = await listTasks(params)
      if (requestSeq !== this.listQueryRequestSeq) return
      this.tasks = next
    } catch (e) {
      if (requestSeq !== this.listQueryRequestSeq) return
      const msg = apiErrorMessage(e, UI_MESSAGES.failedLoadTasks)
      this.showToast(msg, 'error')
      this.healthStatus = 'down'
      this.healthMessage = msg
    } finally {
      if (requestSeq !== this.listQueryRequestSeq) return
      this.loading = false
    }
  }

  private shouldUseServerTaskQuery(): boolean {
    return this.serverTaskQueryEnabled && !Capacitor.isNativePlatform()
  }

  get isServerTaskQueryMode(): boolean {
    return this.shouldUseServerTaskQuery()
  }

  private refreshTasksAfterMutationIfNeeded(): void {
    if (!this.shouldUseServerTaskQuery()) return
    void this.loadTasks()
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin'
  }

  /** Admin lists (users, audit) only in a wide browser tab — not in Capacitor native shells. */
  get adminShellReady(): boolean {
    return this.isAdmin && !Capacitor.isNativePlatform() && this.viewportWidth >= ADMIN_UI_MIN_WIDTH_PX
  }

  get createTaskTitleFieldValid(): boolean {
    return taskTitleOk(this.title)
  }

  get createTaskDueFieldValid(): boolean {
    const iso = dueAtIsoFromPicker(this.dueDateTimeStr, parseDateTimeUK)
    if (!iso) return false
    return new Date(iso).getTime() > Date.now()
  }

  get editTaskTitleFieldValid(): boolean {
    return taskTitleOk(this.editTitle)
  }

  /** Viewers are read-only when auth is required; editors and admins can change tasks. */
  get canMutateTasks(): boolean {
    if (!this.authRequired) return true
    const r = this.currentUser?.role
    return r === 'editor' || r === 'admin'
  }

  get canAccessTasks(): boolean {
    return Boolean(this.currentUser) || !this.authRequired
  }

  /** True when the UI expects a signed-in user (VITE_AUTH_REQUIRED is not `false`). */
  get isAuthRequired(): boolean {
    return this.authRequired
  }

  get menuInitials(): string {
    const name = this.currentUser?.username?.trim()
    if (!name) return ''
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
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

  /** List view column header: toggle direction on active column, otherwise switch column with a sensible default order. */
  toggleTaskTableSort(nextKey: SortKey): void {
    if (this.sortKey === nextKey) {
      this.sortAscending = !this.sortAscending
    } else {
      this.sortKey = nextKey
      this.sortAscending = nextKey === 'created' ? false : true
    }
    this.listPage = 1
  }

  toggleAuditSort(field: AuditLogsSortField): void {
    if (this.auditSort === field) {
      this.auditOrder = this.auditOrder === 'asc' ? 'desc' : 'asc'
    } else {
      this.auditSort = field
      this.auditOrder =
        field === 'created_at' ? 'desc' : field === 'username' || field === 'action' ? 'asc' : 'asc'
    }
    void this.loadAuditLogs()
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
    this.showToast(UI_MESSAGES.settingsRestored, 'notification')
  }

  setViewModeFromUi(next: ViewMode): void {
    this.activeMainTab = 'tasks'
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
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to create tasks.', 'warning')
      return
    }
    const titleTrim = this.quickAddTitle.trim()
    if (!titleTrim) {
      this.showToast(UI_MESSAGES.enterTaskTitle, 'warning')
      return
    }
    const dueAtISO = dueAtIsoFromPicker(this.quickAddDateTimeStr, parseDateTimeUK)
    if (!dueAtISO) {
      this.showToast(UI_MESSAGES.enterValidDueDateTime, 'warning')
      return
    }
    if (new Date(dueAtISO).getTime() < Date.now()) {
      this.showToast(UI_MESSAGES.dueDateMustBeFuture, 'warning')
      return
    }
    this.quickAddSubmitting = true
    try {
      const created = await createTask({
        title: titleTrim,
        status: 'todo',
        priority: 'normal',
        dueAt: dueAtISO,
        owner: this.currentUser?.username,
      })
      // Keep source insertion O(1); view ordering is handled by derived sorting.
      this.tasks = [...this.tasks, created]
      this.quickAddTitle = ''
      this.quickAddDateTimeStr = ''
      this.markOnboardingStep('create_task')
      this.showToast(UI_MESSAGES.taskCreated, 'notification')
      this.refreshTasksAfterMutationIfNeeded()
    } catch (e) {
      this.showToast(apiErrorMessage(e, UI_MESSAGES.failedCreateTask), 'error')
    } finally {
      this.quickAddSubmitting = false
    }
  }

  async handleCreateTask(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to create tasks.', 'warning')
      return
    }
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
      // Keep source insertion O(1); view ordering is handled by derived sorting.
      this.tasks = [...this.tasks, created]
      this.closeCreateModal()
      this.markOnboardingStep('create_task')
      this.showToast(UI_MESSAGES.taskCreated, 'notification')
      this.refreshTasksAfterMutationIfNeeded()
    } catch (e) {
      this.showToast(apiErrorMessage(e, UI_MESSAGES.failedCreateTask), 'error')
    }
  }

  async handleEditTask(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (this.editModalTaskId == null) return
    if (!this.editTitle.trim()) {
      this.showToast(UI_MESSAGES.titleRequired, 'warning')
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
      this.showToast(UI_MESSAGES.taskUpdated, 'notification')
      this.refreshTasksAfterMutationIfNeeded()
    } catch (e) {
      this.showToast(apiErrorMessage(e, UI_MESSAGES.failedUpdateTask), 'error')
    }
  }

  handleDeleteTask(taskId: string): void {
    if (!this.canMutateTasks) {
      this.showToast('You do not have permission to delete tasks.', 'warning')
      return
    }
    this.openDeleteModal(taskId)
  }

  tasksForColumn(status: TaskStatus): Task[] {
    return tasksForColumnUtil(this.visibleTasks, status)
  }

  mergeColumnIntoTasks(status: TaskStatus, items: Task[]): void {
    this.tasks = mergeColumnIntoTasksUtil(this.tasks, status, items)
  }

  handleKanbanConsider(status: TaskStatus, e: CustomEvent<{ items: Task[] }>): void {
    if (!this.canMutateTasks) return
    const items = e.detail?.items
    if (!assertInvariant(Array.isArray(items), 'kanban consider missing items payload')) return
    this.mergeColumnIntoTasks(status, items as Task[])
  }

  async handleKanbanFinalize(status: TaskStatus, e: CustomEvent<{ items: Task[] }>): Promise<void> {
    if (!this.canMutateTasks) {
      await this.loadTasks()
      return
    }
    const items = e.detail?.items
    if (!assertInvariant(Array.isArray(items), 'kanban finalize missing items payload')) return
    const changed = await finalizeKanbanColumnDrop({
      status,
      items: items as Task[],
      tasks: this.tasks,
      setTasks: (next) => {
        this.tasks = next
      },
      updateTaskStatus,
      showToast: (m, t) => this.showToast(m, t),
    })
    if (
      changed &&
      this.tourRunning &&
      this.tourSteps[this.tourStepIndex]?.id === 'kanban_drag'
    ) {
      this.markOnboardingStep('kanban_drag')
    }
    this.refreshTasksAfterMutationIfNeeded()
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
    const resolved = resolveBootstrapState({
      boot,
      defaults: {
        theme: this.theme,
        fontSize: this.fontSize,
        viewMode: this.viewMode,
        sortKey: this.sortKey,
        sortAscending: this.sortAscending,
        statusFilter: this.statusFilter,
        priorityFilter: this.priorityFilter,
        ownerFilter: this.ownerFilter,
        tagFilters: this.tagFilters,
        searchTerm: this.searchTerm,
        debouncedSearchTerm: this.debouncedSearchTerm,
        filterFrom: this.filterFrom,
        filterTo: this.filterTo,
        showFilters: this.showFilters,
        density: this.density,
        motionPreference: this.motionPreference,
        startupViewMode: this.startupViewMode,
        defaultSortKey: this.defaultSortKey,
        defaultSortAscending: this.defaultSortAscending,
      },
      isNarrow: this.isNarrow,
      isNativePlatform: Capacitor.isNativePlatform(),
      systemTheme: systemPreferredTheme,
    })

    this.theme = resolved.theme
    this.fontSize = resolved.fontSize
    this.viewMode = resolved.viewMode
    this.sortKey = resolved.sortKey
    this.sortAscending = resolved.sortAscending
    this.statusFilter = resolved.statusFilter
    this.priorityFilter = resolved.priorityFilter
    this.ownerFilter = resolved.ownerFilter
    this.tagFilters = resolved.tagFilters
    this.searchTerm = resolved.searchTerm
    this.debouncedSearchTerm = resolved.debouncedSearchTerm
    this.filterFrom = resolved.filterFrom
    this.filterTo = resolved.filterTo
    this.showFilters = resolved.showFilters
    this.density = resolved.density
    this.motionPreference = resolved.motionPreference
    this.startupViewMode = resolved.startupViewMode
    this.defaultSortKey = resolved.defaultSortKey
    this.defaultSortAscending = resolved.defaultSortAscending
    this.savedViews = loadSavedViewsFromStorage()

    applyTheme(this.theme, Boolean(boot.theme))
    applyFontSize(this.fontSize)
    applyDensity(this.density)
    applyMotionPreference(this.motionPreference)
    void this.refreshHealth()
    void this.loadCurrentUser()
    void this.loadTasks()
    const params = new URLSearchParams(window.location.search)
    const resetToken = params.get('resetToken')
    if (resetToken && resetToken.trim()) {
      this.helpModalOpen = true
      this.helpActiveTab = 'profile'
      this.authResetMode = 'confirm'
      this.authResetToken = resetToken.trim()
      params.delete('resetToken')
    }
    const oauth = params.get('oauth')
    if (oauth) {
      this.oauthStatus = oauth
      const mapped = this.oauthStatusMessage(oauth)
      this.showToast(mapped.message, mapped.type)
      params.delete('oauth')
    }
    const next = params.toString()
    const newURL = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    history.replaceState(null, '', newURL)

    void tick().then(() => {
      if (!isAutoHelpDismissed()) {
        this.helpModalOpen = true
        this.helpActiveTab = 'profile'
      }
    })
  }

  async loadCurrentUser(): Promise<void> {
    try {
      this.currentUser = await me()
      if (this.currentUser?.role === 'admin' && this.adminShellReady) {
        await this.loadUsers()
        await this.loadAuditLogs()
        this.adminShellDataSynced = true
      }
      if (this.canMutateTasks) {
        void this.loadAssignableDisplayNames()
      }
    } catch {
      this.currentUser = null
      this.users = []
      this.usersTotal = 0
      this.assignableDisplayNames = []
    }
  }

  async loadAssignableDisplayNames(): Promise<void> {
    if (!this.canMutateTasks) return
    try {
      const { displayNames } = await listUserDisplayNames()
      this.assignableDisplayNames = displayNames
    } catch {
      this.assignableDisplayNames = []
    }
  }

  blurAuthField(field: string): void {
    this.authFieldBlurred = { ...this.authFieldBlurred, [field]: true }
  }

  touchCreateField(field: 'title' | 'due'): void {
    this.createFieldBlurred = { ...this.createFieldBlurred, [field]: true }
  }

  touchEditField(field: 'title' | 'due'): void {
    this.editFieldBlurred = { ...this.editFieldBlurred, [field]: true }
  }

  setAuthPasswordConfirm(value: string): void {
    this.authPasswordConfirm = value
    this.authErrors.passwordConfirm = ''
    this.authErrors.form = ''
  }

  setAuthRecoverEmail(value: string): void {
    this.authRecoverEmail = value
    this.authErrors.recoverEmail = ''
    this.authErrors.form = ''
  }

  openAuthGateRecover(): void {
    this.authGateSubview = 'recover'
    this.authErrors = this.emptyAuthErrors()
    if (!this.authRecoverEmail.trim() && this.authEmail.trim()) {
      this.authRecoverEmail = this.authEmail
    }
  }

  backAuthGateSignin(): void {
    this.authGateSubview = 'signin'
    this.authErrors = this.emptyAuthErrors()
  }

  async submitAuthGateRecover(): Promise<void> {
    this.authErrors = this.emptyAuthErrors()
    const email = this.authRecoverEmail.trim()
    if (!email) {
      this.authErrors.recoverEmail = 'Email is required.'
      return
    }
    if (!email.includes('@')) {
      this.authErrors.recoverEmail = 'Enter a valid email address.'
      return
    }
    try {
      const res = await recoverPassword({ email })
      if (res.message) {
        this.showToast(res.message, 'notification')
      } else if (res.token) {
        this.authResetToken = res.token
        if (res.resetUrl) {
          this.showToast(`Recovery link generated (dev): ${res.resetUrl}`, 'notification')
        } else {
          this.showToast('Recovery token generated (dev mode).', 'notification')
        }
      } else {
        this.showToast('If the account exists, a reset link has been sent.', 'notification')
      }
      this.backAuthGateSignin()
    } catch (e) {
      this.applyAuthApiError(e)
      this.showToast(apiErrorMessage(e, 'Failed to request recovery'), 'error')
    }
  }

  async submitAuth(): Promise<void> {
    this.authErrors = this.emptyAuthErrors()
    const email = this.authEmail.trim()
    const firstName = this.authFirstName.trim()
    const lastName = this.authLastName.trim()
    const username = this.authUsername.trim()
    const password = this.authPassword.trim()
    const confirm = this.authPasswordConfirm.trim()
    if (!email) this.authErrors.email = 'Email is required.'
    if (email && !email.includes('@')) this.authErrors.email = 'Enter a valid email address.'
    if (this.authMode === 'register' && !firstName) this.authErrors.firstName = 'First name is required.'
    if (this.authMode === 'register' && !lastName) this.authErrors.lastName = 'Last name is required.'
    if (this.authMode === 'register' && !username) this.authErrors.username = 'Display name is required.'
    if (!password) this.authErrors.password = 'Password is required.'
    if (password && password.length < 10) this.authErrors.password = 'Password must be at least 10 characters.'
    if (password && !/[A-Z]/.test(password)) this.authErrors.password = 'Password must include one uppercase letter.'
    if (password && !/[0-9]/.test(password)) this.authErrors.password = 'Password must include one number.'
    if (password && !/[^A-Za-z0-9]/.test(password)) this.authErrors.password = 'Password must include one special character.'
    if (this.authMode === 'register' && password && confirm && password !== confirm) {
      this.authErrors.passwordConfirm = 'Passwords do not match.'
    }
    if (this.authMode === 'register' && !confirm) {
      this.authErrors.passwordConfirm = 'Please confirm your password.'
    }
    if (Object.values(this.authErrors).some(Boolean)) return
    try {
      if (this.authMode === 'register') {
        await register({ email, firstName, lastName, username, password })
      }
      this.currentUser = await login({ email, password })
      this.authPassword = ''
      this.authPasswordConfirm = ''
      if (this.currentUser.role === 'admin' && this.adminShellReady) {
        await this.loadUsers()
        await this.loadAuditLogs()
        this.adminShellDataSynced = true
      }
      if (this.canMutateTasks) {
        void this.loadAssignableDisplayNames()
      }
      this.showToast(`Signed in as ${this.currentUser.username}`, 'notification')
    } catch (e) {
      this.applyAuthApiError(e)
      this.showToast(apiErrorMessage(e, 'Authentication failed'), 'error')
    }
  }

  async requestPasswordRecovery(): Promise<void> {
    this.authErrors = this.emptyAuthErrors()
    const email = this.authEmail.trim()
    if (!email) {
      this.authErrors.email = 'Email is required.'
      return
    }
    if (!email.includes('@')) {
      this.authErrors.email = 'Enter a valid email address.'
      return
    }
    try {
      const res = await recoverPassword({ email })
      this.authResetMode = 'request'
      if (res.token) {
        this.authResetToken = res.token
        if (res.resetUrl) {
          this.showToast(`Recovery link generated (dev): ${res.resetUrl}`, 'notification')
        } else {
          this.showToast('Recovery token generated (dev mode).', 'notification')
        }
      } else {
        this.showToast('If the account exists, a reset link has been sent.', 'notification')
      }
    } catch (e) {
      this.applyAuthApiError(e)
      this.showToast(apiErrorMessage(e, 'Failed to request recovery'), 'error')
    }
  }

  async submitPasswordReset(): Promise<void> {
    this.authErrors = this.emptyAuthErrors()
    const token = this.authResetToken.trim()
    const newPassword = this.authNewPassword.trim()
    if (!token) this.authErrors.resetToken = 'Reset token is required.'
    if (!newPassword) this.authErrors.newPassword = 'New password is required.'
    if (newPassword && newPassword.length < 10) this.authErrors.newPassword = 'New password must be at least 10 characters.'
    if (newPassword && !/[A-Z]/.test(newPassword)) this.authErrors.newPassword = 'New password must include one uppercase letter.'
    if (newPassword && !/[0-9]/.test(newPassword)) this.authErrors.newPassword = 'New password must include one number.'
    if (newPassword && !/[^A-Za-z0-9]/.test(newPassword)) this.authErrors.newPassword = 'New password must include one special character.'
    if (Object.values(this.authErrors).some(Boolean)) return
    try {
      await resetPassword({ token, newPassword })
      this.authResetMode = 'none'
      this.authResetToken = ''
      this.authNewPassword = ''
      this.showToast('Password reset successful. Please log in.', 'notification')
    } catch (e) {
      this.applyAuthApiError(e)
      this.showToast(apiErrorMessage(e, 'Failed to reset password'), 'error')
    }
  }

  setAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode
    this.authGateSubview = 'signin'
    this.authErrors = this.emptyAuthErrors()
    this.authPasswordConfirm = ''
  }

  setAuthEmail(value: string): void {
    this.authEmail = value
    this.authErrors.email = ''
    this.authErrors.form = ''
  }

  setAuthFirstName(value: string): void {
    this.authFirstName = value
    this.authErrors.firstName = ''
    this.authErrors.form = ''
  }

  setAuthLastName(value: string): void {
    this.authLastName = value
    this.authErrors.lastName = ''
    this.authErrors.form = ''
  }

  setAuthUsername(value: string): void {
    this.authUsername = value
    this.authErrors.username = ''
    this.authErrors.form = ''
  }

  setAuthPassword(value: string): void {
    this.authPassword = value
    this.authErrors.password = ''
    this.authErrors.passwordConfirm = ''
    this.authErrors.form = ''
  }

  setAuthResetMode(mode: 'none' | 'request' | 'confirm'): void {
    this.authResetMode = mode
    this.authErrors.resetToken = ''
    this.authErrors.newPassword = ''
    this.authErrors.form = ''
  }

  setAuthResetToken(value: string): void {
    this.authResetToken = value
    this.authErrors.resetToken = ''
    this.authErrors.form = ''
  }

  setAuthNewPassword(value: string): void {
    this.authNewPassword = value
    this.authErrors.newPassword = ''
    this.authErrors.form = ''
  }

  private applyAuthApiError(error: unknown): void {
    if (!(error instanceof ApiError) || !error.code) return
    switch (error.code) {
      case 'email_required':
      case 'invalid_email':
        this.authErrors.email = error.message
        this.authErrors.recoverEmail = error.message
        break
      case 'username_required':
        this.authErrors.username = error.message
        break
      case 'first_name_required':
        this.authErrors.firstName = error.message
        break
      case 'last_name_required':
        this.authErrors.lastName = error.message
        break
      case 'password_required':
      case 'password_too_short':
      case 'password_weak':
      case 'invalid_credentials':
        this.authErrors.password = error.message
        break
      case 'validation_error':
        if (error.message.toLowerCase().includes('match')) {
          this.authErrors.passwordConfirm = error.message
        } else {
          this.authErrors.form = error.message
        }
        break
      case 'reset_token_required':
      case 'invalid_reset_token':
        this.authErrors.resetToken = error.message
        break
      case 'new_password_required':
      case 'new_password_too_short':
      case 'new_password_weak':
        this.authErrors.newPassword = error.message
        break
      default:
        this.authErrors.form = error.message
    }
  }

  async signOut(): Promise<void> {
    try {
      await logout()
    } finally {
      this.closeHelp()
      this.currentUser = null
      this.users = []
      this.usersTotal = 0
      this.selectedUserIds = new Set()
      this.editUserTarget = null
      this.deleteUserModalIds = null
      this.usersSearchTerm = ''
      this.usersDebouncedSearch = ''
      this.usersRoleFilter = ''
      this.usersPage = 1
      this.auditLogs = []
      this.auditQuery = ''
      this.auditUserId = ''
      this.auditChangedField = ''
      this.activeMainTab = 'tasks'
      this.assignableDisplayNames = []
      this.adminShellDataSynced = false
      this.authPasswordConfirm = ''
      this.authShowPassword = false
      this.authRecoverEmail = ''
      this.authGateSubview = 'signin'
      this.authFieldBlurred = {}
      this.createFieldBlurred = { title: false, due: false }
      this.editFieldBlurred = { title: false, due: false }
    }
  }

  /** Tasks / Users / Audit control row; refreshes admin data when switching tabs. */
  setActiveMainTab(tab: 'tasks' | 'users' | 'audit'): void {
    this.activeMainTab = tab
    if (!this.isAdmin) return
    if (tab === 'users' || tab === 'audit') this.markOnboardingStep('admin_main_tabs')
    if (tab === 'audit') {
      this.markOnboardingStep('admin_audit_review')
      void this.loadAuditLogs()
    }
  }

  clearAuditFilters(): void {
    this.auditQuery = ''
    this.auditUserId = ''
    this.auditChangedField = ''
    void this.loadAuditLogs()
  }

  setAuditChangedField(field: string): void {
    if (this.auditChangedField === field) {
      this.auditChangedField = ''
    } else {
      this.auditChangedField = field
    }
    void this.loadAuditLogs()
  }

  startOAuth(provider: 'github' | 'google' | 'apple'): void {
    window.location.assign(`/api/auth/oauth/${provider}/start`)
  }

  oauthStatusMessage(code: string): { message: string; type: ToastType } {
    const normalized = code.trim().toLowerCase()
    switch (normalized) {
      case 'oauth_success':
        return { message: 'OAuth sign-in successful.', type: 'notification' }
      case 'oauth_provider_misconfigured':
        return { message: 'OAuth provider is not configured.', type: 'error' }
      case 'oauth_state_mismatch':
        return { message: 'OAuth state check failed. Please try again.', type: 'warning' }
      case 'oauth_token_exchange_failed':
        return { message: 'OAuth token exchange failed.', type: 'error' }
      case 'oauth_profile_fetch_failed':
        return { message: 'OAuth profile lookup failed.', type: 'error' }
      case 'oauth_provider_error':
        return { message: 'OAuth provider denied the sign-in request.', type: 'warning' }
      case 'password_reset_link_sent':
        return { message: 'Password reset link sent. Check your email.', type: 'notification' }
      default:
        return {
          message: `OAuth status: ${code}`,
          type: normalized.includes('error') ? 'warning' : 'notification',
        }
    }
  }

  async loadUsers(): Promise<void> {
    if (!this.isAdmin) return
    this.usersLoading = true
    try {
      const offset = (this.usersPage - 1) * this.usersPageSize
      const { users, total } = await listUsers({
        q: this.usersDebouncedSearch.trim() || undefined,
        role: this.usersRoleFilter || undefined,
        sort: this.usersSortKey,
        order: this.usersSortAscending ? 'asc' : 'desc',
        limit: this.usersPageSize,
        offset,
      })
      this.users = users
      this.usersTotal = total
    } catch (e) {
      this.showToast(apiErrorMessage(e, 'Failed to load users'), 'error')
    } finally {
      this.usersLoading = false
    }
  }

  clearUsersFilters(): void {
    const had =
      this.usersSearchTerm.trim() !== '' || this.usersRoleFilter !== '' || this.usersDebouncedSearch.trim() !== ''
    this.usersSearchTerm = ''
    this.usersDebouncedSearch = ''
    this.usersRoleFilter = ''
    this.usersPage = 1
    if (had) this.showToast('User filters cleared.', 'notification')
  }

  toggleUsersFiltersPanel(): void {
    this.showUsersFilters = !this.showUsersFilters
    if (this.showUsersFilters) this.markOnboardingStep('admin_users_filters')
  }

  toggleUsersSort(field: UsersSortField): void {
    if (this.usersSortKey === field) {
      this.usersSortAscending = !this.usersSortAscending
    } else {
      this.usersSortKey = field
      this.usersSortAscending = field === 'email' || field === 'username' || field === 'first_name' || field === 'last_name'
    }
    this.usersPage = 1
  }

  setUsersRoleFilter(role: '' | UserRole): void {
    this.usersRoleFilter = role
    this.usersPage = 1
  }

  toggleUserSelection(id: string): void {
    const next = new Set(this.selectedUserIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    this.selectedUserIds = next
  }

  selectAllUsersOnPage(): void {
    const ids = this.users.map((u) => u.id)
    if (ids.length === 0) return
    const allSelected = ids.every((id) => this.selectedUserIds.has(id))
    if (allSelected) {
      const next = new Set(this.selectedUserIds)
      for (const id of ids) next.delete(id)
      this.selectedUserIds = next
    } else {
      const next = new Set(this.selectedUserIds)
      for (const id of ids) next.add(id)
      this.selectedUserIds = next
    }
  }

  clearUserSelection(): void {
    this.selectedUserIds = new Set()
  }

  openEditUserModal(user: AuthUser): void {
    this.editUserTarget = user
    this.editUserFirstName = user.firstName
    this.editUserLastName = user.lastName
    this.editUserUsername = user.username
    tick().then(() => this.editUserModalFirstInput?.focus())
  }

  closeEditUserModal(): void {
    this.editUserTarget = null
  }

  async saveEditUserProfile(): Promise<void> {
    const u = this.editUserTarget
    if (!u) return
    const fn = this.editUserFirstName.trim()
    const ln = this.editUserLastName.trim()
    const un = this.editUserUsername.trim()
    if (!fn) {
      this.showToast('First name is required.', 'warning')
      return
    }
    if (!ln) {
      this.showToast('Last name is required.', 'warning')
      return
    }
    if (!un) {
      this.showToast('Display name is required.', 'warning')
      return
    }
    try {
      await updateUser(u.id, {
        email: u.email,
        username: un,
        firstName: fn,
        lastName: ln,
        role: u.role,
      })
      this.closeEditUserModal()
      this.showToast('User profile updated.', 'notification')
      await this.loadUsers()
    } catch (e) {
      this.showToast(apiErrorMessage(e, 'Failed to update user'), 'error')
    }
  }

  async updateAdminUserRole(id: string, role: UserRole): Promise<void> {
    const u = this.users.find((x) => x.id === id)
    if (!u || u.role === role) return
    try {
      await updateUser(id, {
        email: u.email,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role,
      })
      this.showToast('User permissions updated.', 'notification')
      await this.loadUsers()
    } catch (e) {
      this.showToast(apiErrorMessage(e, 'Failed to update role'), 'error')
    }
  }

  async requestAdminUserPasswordReset(userId: string): Promise<void> {
    try {
      const res = await requestUserPasswordReset(userId)
      const msg =
        res.message ??
        'A password reset link has been sent. The user should check email and follow the link to choose a new password.'
      this.showToast(msg, 'notification')
      if (import.meta.env.DEV && res.resetUrl) {
        console.info('[admin password reset]', res.resetUrl, res.token)
      }
    } catch (e) {
      this.showToast(apiErrorMessage(e, 'Failed to send password reset'), 'error')
    }
  }

  openBulkDeleteUsersModal(): void {
    if (this.selectedUserIds.size === 0) return
    this.deleteUserModalIds = [...this.selectedUserIds]
  }

  openSingleDeleteUserModal(id: string): void {
    this.deleteUserModalIds = [id]
  }

  closeDeleteUsersModal(): void {
    this.deleteUserModalIds = null
  }

  async performDeleteUsers(): Promise<void> {
    if (!this.deleteUserModalIds?.length) return
    const ids = [...this.deleteUserModalIds]
    const removedSet = new Set(ids)
    const snapshots = new Map(
      this.users
        .filter((u) => removedSet.has(u.id))
        .map((u) => [u.id, u] as const),
    )
    this.closeDeleteUsersModal()
    this.selectedUserIds = new Set()
    this.users = this.users.filter((u) => !removedSet.has(u.id))
    this.usersTotal = Math.max(0, this.usersTotal - ids.length)

    let cancelled = false
    let undoToastId = 0
    const commitTimer = setTimeout(async () => {
      if (cancelled) return
      let ok = 0
      for (const id of ids) {
        try {
          await deleteUser(id)
          ok++
        } catch (e) {
          this.showToast(apiErrorMessage(e, 'Failed to delete user'), 'error')
        }
      }
      if (ok > 0) {
        this.showToast(ok === 1 ? 'User deleted.' : `${ok} users deleted.`, 'notification')
      }
      this.dismissToast(undoToastId)
      await this.loadUsers()
    }, this.userDeleteUndoWindowMs)

    undoToastId = this.showToast('User deletion pending. Undo?', 'warning', {
      actionLabel: UI_MESSAGES.undo,
      durationMs: this.userDeleteUndoWindowMs,
      countdownFromSeconds: Math.ceil(this.userDeleteUndoWindowMs / 1000),
      onAction: () => {
        if (cancelled) return
        cancelled = true
        clearTimeout(commitTimer)
        const existing = new Set(this.users.map((u) => u.id))
        const restore = ids
          .map((id) => snapshots.get(id))
          .filter((u): u is AuthUser => Boolean(u))
          .filter((u) => !existing.has(u.id))
        if (restore.length > 0) {
          this.users = [...restore, ...this.users]
          this.usersTotal += restore.length
        }
        this.dismissToast(undoToastId)
      },
    })
  }

  async loadAuditLogs(): Promise<void> {
    if (!this.isAdmin) return
    try {
      this.auditLogs = await listAuditLogs({
        userId: this.auditUserId || undefined,
        q: this.auditQuery || undefined,
        field: this.auditChangedField || undefined,
        sort: this.auditSort,
        order: this.auditOrder,
        limit: 500,
      })
    } catch (e) {
      this.showToast(apiErrorMessage(e, 'Failed to load audit logs'), 'error')
    }
  }

}
