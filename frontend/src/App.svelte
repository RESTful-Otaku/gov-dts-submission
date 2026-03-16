<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { slide, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'

  /** Create/edit modal: fade on web, slide from left on narrow (drawer). */
  function modalContentTransition(
    node: HTMLElement,
    params: { isNarrow?: boolean }
  ): ReturnType<typeof slide> | ReturnType<typeof fade> {
    if (params.isNarrow) return slide(node, { duration: 260, easing: cubicOut, axis: 'x' })
    return fade(node, { duration: 200 })
  }
  import { flip } from 'svelte/animate'
  import { dndzone } from 'svelte-dnd-action'
  import SveltyPicker from 'svelty-picker'
  import { en as pickerEn } from 'svelty-picker/i18n'
  import govLogo from '../assets/gov_uk.webp'
  import type { Task, TaskPriority, TaskStatus } from './lib/api'
  import { ApiError, createTask, deleteTask, healthReady, listTasks, updateTask, updateTaskStatus } from './lib/api'

  /** UK locale: week starts Monday; date/time picker format dd-mm-yyyy HH:ii AM/PM */
  const PICKER_I18N = { ...pickerEn, weekStart: 1 }
  const DATETIME_FORMAT = 'dd-mm-yyyy HH:ii P'
  const DATE_FORMAT = 'dd-mm-yyyy'

  let tasks: Task[] = []
  let loading = false
  let healthStatus: 'ok' | 'degraded' | 'down' | 'unknown' = 'unknown'
  let healthMessage = ''

  type ToastType = 'error' | 'warning' | 'notification'
  type Toast = {
    id: number
    message: string
    type: ToastType
    timeoutId: ReturnType<typeof setTimeout>
    exiting?: boolean
  }
  let toasts: Toast[] = []
  let nextToastId = 0
  const TOAST_EXIT_MS = 250

  function showToast(message: string, type: ToastType) {
    const id = ++nextToastId
    const duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000
    const timeoutId = setTimeout(() => dismissToast(id), duration)
    toasts = [...toasts, { id, message, type, timeoutId }]
  }

  function dismissToast(id: number) {
    const t = toasts.find((x) => x.id === id)
    if (!t) return
    clearTimeout(t.timeoutId)
    const exiting = toasts.map((x) => (x.id === id ? { ...x, exiting: true } : x))
    toasts = exiting
    setTimeout(() => {
      toasts = toasts.filter((x) => x.id !== id)
    }, TOAST_EXIT_MS)
  }

  type ViewMode = 'cards' | 'list' | 'kanban'
  let viewMode: ViewMode = 'cards'

  // Responsive layout: isNarrow = mobile; mobileSearchExpanded = search bar open on mobile
  let isNarrow = false
  let mobileSearchExpanded = false

  type SortKey = 'due' | 'title' | 'priority'
  let sortKey: SortKey = 'due'
  let sortAscending = true

  /** List view (web only): page size and current page (1-based). */
  const LIST_PAGE_SIZES = [10, 20, 30] as const
  type ListPageSize = (typeof LIST_PAGE_SIZES)[number]
  let listPageSize: ListPageSize = 20
  let listPage = 1

  const PRIORITY_ORDER: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  }

  type Theme = 'light' | 'dark'
  let theme: Theme = 'light'

  type FontSize = 'normal' | 'large' | 'xlarge'
  let fontSize: FontSize = 'normal'

  type StatusFilter = 'all' | TaskStatus
  type PriorityFilter = 'all' | TaskPriority
  let searchTerm = ''
  let debouncedSearchTerm = ''
  let searchDebounceId: ReturnType<typeof setTimeout> | null = null
  let statusFilter: StatusFilter = 'all'
  let priorityFilter: PriorityFilter = 'all'
  let ownerFilter = ''
  let tagFilter = ''
  let filterFrom = ''
  let filterTo = ''
  let showFilters = false

  let createModalOpen = false
  /** Task ID for edit modal; null = closed */
  let editModalTaskId: string | null = null
  let editTitle = ''
  let editDescription = ''
  let editStatus: TaskStatus = 'todo'
  let editPriority: TaskPriority = 'normal'
  let editTagsInput = ''
  let editModalFirstInput: HTMLInputElement | null = null
  /** Single or multiple task IDs for delete confirmation modal; null = closed */
  let deleteModalTaskIds: string[] | null = null
  /** Task IDs selected in list view for bulk actions */
  let selectedTaskIds: Set<string> = new Set()
  let title = ''
  let description = ''
  let status: TaskStatus = 'todo'
  let priority: TaskPriority = 'normal'
  let owner = ''
  let tagsInput = ''
  /** Create modal: due date+time in picker format (dd-mm-yyyy HH:ii P) */
  let dueDateTimeStr = ''
  let modalFirstInput: HTMLInputElement | null = null
  let searchInput: HTMLInputElement | null = null
  let quickAddTitle = ''
  /** Quick-add row: due date+time in picker format (dd-mm-yyyy HH:ii P) */
  let quickAddDateTimeStr = ''
  let quickAddSubmitting = false

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ]

  const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]

  function statusLabel(s: TaskStatus): string {
    return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s
  }

  function priorityLabel(p: TaskPriority): string {
    return PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p ?? 'Normal'
  }

  function resetForm() {
    title = ''
    description = ''
    status = 'todo'
    priority = 'normal'
    owner = ''
    tagsInput = ''
    dueDateTimeStr = ''
  }

  function formatUKDateString(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  /** Value for SveltyPicker datetime in UK format: dd-mm-yyyy HH:ii P */
  function toDateTimePickerValue(d: Date): string {
    const datePart = formatUKDateString(d)
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    if (hours === 0) hours = 12
    const hh = String(hours).padStart(2, '0')
    return `${datePart} ${hh}:${minutes} ${period}`
  }

  /** Parse SveltyPicker datetime string (dd-mm-yyyy HH:ii P) to ISO string, or null if invalid. */
  function parseDateTimeUK(s: string): string | null {
    const trimmed = s?.trim()
    if (!trimmed) return null
    const parts = trimmed.split(/\s+/)
    if (parts.length < 3) return null
    const datePart = parts[0]
    const timePart = parts[1]
    const periodPart = (parts[2]?.toUpperCase() === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM'
    const d = parseUKDate(datePart)
    const t = parse12HourTime(timePart, periodPart)
    if (!d || !t) return null
    const due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hours, t.minutes, 0, 0)
    return Number.isNaN(due.getTime()) ? null : due.toISOString()
  }

  function openCreateModal() {
    resetForm()
    const now = new Date()
    dueDateTimeStr = toDateTimePickerValue(now)
    priority = 'normal'
    createModalOpen = true
    tick().then(() => modalFirstInput?.focus())
  }

  function closeCreateModal() {
    createModalOpen = false
  }

  function toggleFilters() {
    showFilters = !showFilters
  }

  function openEditModal(task: Task) {
    editModalTaskId = task.id
    editTitle = task.title
    editDescription = task.description ?? ''
    editStatus = task.status
    editPriority = (task.priority ?? 'normal') as TaskPriority
    editTagsInput = (task.tags ?? []).join(', ')
    tick().then(() => editModalFirstInput?.focus())
  }

  function closeEditModal() {
    editModalTaskId = null
  }

  function handleModalBackdropClick(event: MouseEvent) {
    if (!(event.target as HTMLElement).classList.contains('modal-backdrop')) return
    if (createModalOpen) closeCreateModal()
    if (editModalTaskId !== null) closeEditModal()
    if (deleteModalTaskIds !== null) closeDeleteModal()
  }

  function openDeleteModal(taskId: string) {
    deleteModalTaskIds = [taskId]
  }

  function openBulkDeleteModal() {
    if (selectedTaskIds.size === 0) return
    deleteModalTaskIds = [...selectedTaskIds]
  }

  function closeDeleteModal() {
    deleteModalTaskIds = null
  }

  async function performDeleteTask() {
    if (!deleteModalTaskIds?.length) return
    const ids = [...deleteModalTaskIds]
    closeDeleteModal()
    selectedTaskIds = new Set()
    let failed = 0
    for (const id of ids) {
      try {
        await deleteTask(id)
        tasks = tasks.filter((t) => t.id !== id)
      } catch (e) {
        failed++
        showToast(e instanceof Error ? e.message : 'Failed to delete task', 'error')
      }
    }
    if (failed === 0) {
      showToast(ids.length === 1 ? 'Task deleted.' : `${ids.length} tasks deleted.`, 'notification')
    }
  }

  function toggleTaskSelection(id: string) {
    const next = new Set(selectedTaskIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedTaskIds = next
  }

  /** Select or deselect all tasks on the current page. */
  function selectAllInList() {
    const listTasks = listTasksDisplay
    if (selectedTaskIds.size === listTasks.length) {
      selectedTaskIds = new Set()
    } else {
      selectedTaskIds = new Set(listTasks.map((t) => t.id))
    }
  }

  /** Select all tasks in the list (all pages, current filters). */
  function selectAllInListView() {
    selectedTaskIds = new Set(visibleTasks.map((t) => t.id))
  }

  async function bulkSetStatus(newStatus: TaskStatus) {
    if (selectedTaskIds.size === 0) return
    const ids = [...selectedTaskIds]
    try {
      await Promise.all(ids.map((id) => updateTaskStatus(id, { status: newStatus })))
      tasks = tasks.map((t) => (ids.includes(t.id) ? { ...t, status: newStatus } : t))
      selectedTaskIds = new Set()
      showToast(
        ids.length === 1 ? 'Status updated.' : `Status updated for ${ids.length} tasks.`,
        'notification',
      )
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update status', 'error')
    }
  }

  function clearListSelection() {
    selectedTaskIds = new Set()
  }

  /** Sets checkbox indeterminate state (DOM property, not attribute). */
  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value
    return {
      update(value: boolean) {
        node.indeterminate = value
      },
    }
  }

  function handleResize() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0
    isNarrow = width <= 640
    if (!isNarrow) mobileSearchExpanded = false
  }

  let visibleTasks: Task[] = []

  function matchesFilters(
    taskItem: Task,
    qRaw: string,
    status: StatusFilter,
    priority: PriorityFilter,
    ownerQ: string,
    tagQ: string,
    from: string,
    to: string,
  ): boolean {
    const q = qRaw.trim().toLocaleLowerCase()
    if (q) {
      const parts = q.split(/\s+/).filter(Boolean)
      const taskPriority = taskItem.priority ?? 'normal'
      const haystack = [
        taskItem.title,
        taskItem.description ?? '',
        statusLabel(taskItem.status),
        priorityLabel(taskPriority),
        taskItem.owner ?? '',
        (taskItem.tags ?? []).join(' '),
        formatDate(taskItem.dueAt),
      ]
        .join(' ')
        .toLocaleLowerCase()

      for (const part of parts) {
        if (!haystack.includes(part)) return false
      }
    }

    if (status !== 'all' && taskItem.status !== status) {
      return false
    }

    if (priority !== 'all' && (taskItem.priority ?? 'normal') !== priority) {
      return false
    }

    if (ownerQ.trim()) {
      const o = (taskItem.owner ?? '').trim().toLocaleLowerCase()
      if (!o.includes(ownerQ.trim().toLocaleLowerCase())) return false
    }

    if (tagQ.trim()) {
      const taskTags = taskItem.tags ?? []
      const want = tagQ.trim().toLocaleLowerCase()
      if (!taskTags.some((t) => t.toLocaleLowerCase() === want || t.toLocaleLowerCase().includes(want)))
        return false
    }

    const fromStr = from ?? ''
    const toStr = to ?? ''
    if (fromStr || toStr) {
      const due = new Date(taskItem.dueAt)
      if (Number.isNaN(due.getTime())) {
        return false
      }

      if (fromStr) {
        const fromDateObj = parseUKDate(fromStr)
        if (!fromDateObj) return false
        const fromDate = new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), fromDateObj.getDate())
        if (due < fromDate) return false
      }
      if (toStr) {
        const toDateObj = parseUKDate(toStr)
        if (!toDateObj) return false
        const toDate = new Date(toDateObj.getFullYear(), toDateObj.getMonth(), toDateObj.getDate(), 23, 59, 59, 999)
        if (due > toDate) return false
      }
    }

    return true
  }

  /** Returns 'overdue' | 'due-today' | 'due-soon' | '' for styling. */
  function dueState(task: Task): string {
    const due = new Date(task.dueAt)
    if (Number.isNaN(due.getTime())) return ''
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    const weekEnd = new Date(todayStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    if (due < now) return 'overdue'
    if (due >= todayStart && due < todayEnd) return 'due-today'
    if (due >= todayEnd && due < weekEnd) return 'due-soon'
    return ''
  }

  $: hasActiveFilters =
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    !!ownerFilter.trim() ||
    !!tagFilter.trim() ||
    !!filterFrom ||
    !!filterTo

  function clearAllFilters() {
    statusFilter = 'all'
    priorityFilter = 'all'
    ownerFilter = ''
    tagFilter = ''
    filterFrom = ''
    filterTo = ''
    showFilters = true
  }

  function filterByTag(tag: string) {
    tagFilter = tag
    showFilters = true
  }

  $: allTags = Array.from(
    new Set(tasks.flatMap((t) => t.tags ?? []).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  $: uniqueOwners = Array.from(
    new Set(tasks.map((t) => (t.owner ?? '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  $: overdueCount = tasks.filter((t) => dueState(t) === 'overdue').length
  $: dueTodayCount = tasks.filter((t) => dueState(t) === 'due-today').length
  $: dueThisWeekCount = tasks.filter((t) => dueState(t) === 'due-soon').length

  // On small screens, always use the summary cards view.
  $: if (isNarrow && viewMode !== 'cards') {
    viewMode = 'cards'
  }

  $: {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId)
    }
    searchDebounceId = setTimeout(() => {
      debouncedSearchTerm = searchTerm
    }, 200)
  }

  $: visibleTasks = getSortedTasks(
    tasks.filter((t) =>
      matchesFilters(
        t,
        debouncedSearchTerm,
        statusFilter,
        priorityFilter,
        ownerFilter,
        tagFilter,
        filterFrom,
        filterTo,
      ),
    ),
    sortKey,
    sortAscending,
  )

  /** In list view: full list on narrow, paginated slice on web. */
  $: listTasksDisplay =
    viewMode === 'list'
      ? isNarrow
        ? visibleTasks
        : visibleTasks.slice(
            (listPage - 1) * listPageSize,
            listPage * listPageSize,
          )
      : []

  $: totalListPages =
    viewMode === 'list' && !isNarrow
      ? Math.max(1, Math.ceil(visibleTasks.length / listPageSize))
      : 1

  $: if (viewMode === 'list' && !isNarrow && listPage > totalListPages) {
    listPage = totalListPages
  }

  $: listTaskCount = viewMode === 'list' ? listTasksDisplay.length : 0
  $: isSelectAllIndeterminate =
    viewMode === 'list' &&
    listTaskCount > 0 &&
    selectedTaskIds.size > 0 &&
    selectedTaskIds.size < listTaskCount

  /** In list view: true when every filtered task (all pages) is selected. */
  $: allVisibleTasksSelected =
    viewMode === 'list' &&
    visibleTasks.length > 0 &&
    selectedTaskIds.size === visibleTasks.length

  async function loadTasks() {
    loading = true
    try {
      tasks = await listTasks()
      healthStatus = 'ok'
      healthMessage = ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load tasks'
      showToast(msg, 'error')
      healthStatus = 'down'
      healthMessage = msg
    } finally {
      loading = false
    }
  }

  function getSortedTasks(source: Task[], key: SortKey, ascending: boolean): Task[] {
    const copy = [...source]
    copy.sort((a, b) => {
      if (key === 'title') {
        const at = a.title.toLocaleLowerCase()
        const bt = b.title.toLocaleLowerCase()
        if (at < bt) return ascending ? -1 : 1
        if (at > bt) return ascending ? 1 : -1
        return 0
      }
      if (key === 'priority') {
        const ap = PRIORITY_ORDER[(a.priority as TaskPriority) ?? 'normal']
        const bp = PRIORITY_ORDER[(b.priority as TaskPriority) ?? 'normal']
        if (ap < bp) return ascending ? -1 : 1
        if (ap > bp) return ascending ? 1 : -1
        return 0
      }
      // sort by due date
      const ad = new Date(a.dueAt).getTime()
      const bd = new Date(b.dueAt).getTime()
      if (ad < bd) return ascending ? -1 : 1
      if (ad > bd) return ascending ? 1 : -1
      return 0
    })
    return copy
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('task-theme', theme)
  }

  function applyFontSize() {
    const size =
      fontSize === 'normal' ? '16px' : fontSize === 'large' ? '18px' : '20px'
    document.documentElement.style.fontSize = size
    localStorage.setItem('task-font-size', fontSize)
  }

  function setTheme(next: Theme) {
    theme = next
    applyTheme()
  }

  function setFontSize(next: FontSize) {
    fontSize = next
    applyFontSize()
  }

  function persistUiPreferences() {
    localStorage.setItem('task-view-mode', viewMode)
    localStorage.setItem('task-sort-key', sortKey)
    localStorage.setItem('task-sort-ascending', String(sortAscending))
    localStorage.setItem('task-status-filter', statusFilter)
    localStorage.setItem('task-priority-filter', priorityFilter)
    localStorage.setItem('task-owner-filter', ownerFilter)
    localStorage.setItem('task-tag-filter', tagFilter)
    localStorage.setItem('task-search-term', searchTerm)
    localStorage.setItem('task-filter-from', filterFrom ?? '')
    localStorage.setItem('task-filter-to', filterTo ?? '')
    localStorage.setItem('task-show-filters', String(showFilters))
  }

  $: persistUiPreferences()

  function handleGlobalKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      // Allow Escape to close dialogs; otherwise ignore typing in form fields.
      if (event.key !== 'Escape') return
    }

    if (event.key === 'Escape') {
      if (createModalOpen) {
        event.preventDefault()
        closeCreateModal()
        return
      }
      if (editModalTaskId !== null) {
        event.preventDefault()
        closeEditModal()
        return
      }
      if (deleteModalTaskIds !== null) {
        event.preventDefault()
        closeDeleteModal()
        return
      }
    }

    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      searchInput?.focus()
      return
    }

    if (event.key === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      openCreateModal()
      return
    }

    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      if (event.key === '1') {
        viewMode = 'cards'
      } else if (event.key === '2') {
        viewMode = 'list'
      } else if (event.key === '3') {
        viewMode = 'kanban'
      }
    }
  }

  function parseUKDate(dateStr: string): Date | null {
    const trimmed = dateStr.trim()
    if (!trimmed) return null
    // Accept strictly DD-MM-YYYY to avoid US-style ambiguity.
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed)
    if (!match) return null
    const [, dd, mm, yyyy] = match
    const day = Number(dd)
    const month = Number(mm)
    const year = Number(yyyy)
    const d = new Date(year, month - 1, day)
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null
    }
    return d
  }

  /** Parses a date string from either a native date input (YYYY-MM-DD) or UK text (DD-MM-YYYY). */
  function parseDateInput(dateStr: string): Date | null {
    const trimmed = dateStr.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed + 'T12:00:00')
      return Number.isNaN(d.getTime()) ? null : d
    }
    return parseUKDate(trimmed)
  }

  /** Returns DD-MM-YYYY for display in any date field (e.g. from localStorage). */
  function toDisplayDate(dateStr: string): string {
    const d = parseDateInput(dateStr)
    return d ? formatUKDateString(d) : ''
  }

  function parse12HourTime(timeStr: string, period: 'AM' | 'PM'): { hours: number; minutes: number } | null {
    const trimmed = timeStr.trim()
    if (!trimmed) return null
    const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
    if (!match) return null
    let hours = Number(match[1])
    const minutes = Number(match[2])
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null
    if (period === 'PM' && hours < 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return { hours, minutes }
  }

  function getDueAtISO(): string | null {
    if (!dueDateTimeStr?.trim()) return null
    return parseDateTimeUK(dueDateTimeStr)
  }

  function validateForm(): string | null {
    if (!title.trim()) return 'Title is required'
    if (!dueDateTimeStr?.trim()) return 'Due date and time are required'
    const iso = getDueAtISO()
    if (!iso) return 'Due date/time is invalid (use DD-MM-YYYY and 12-hour time)'
    if (new Date(iso).getTime() < Date.now()) return 'Due date/time must be in the future'
    return null
  }

  function getQuickAddDueISO(): string | null {
    if (!quickAddDateTimeStr?.trim()) return null
    return parseDateTimeUK(quickAddDateTimeStr)
  }

  async function handleQuickAdd(event: SubmitEvent) {
    event.preventDefault()
    const titleTrim = quickAddTitle.trim()
    if (!titleTrim) {
      showToast('Enter a title for the task.', 'warning')
      return
    }
    const dueAtISO = getQuickAddDueISO()
    if (!dueAtISO) {
      showToast('Enter a valid due date and time using the picker.', 'warning')
      return
    }
    if (new Date(dueAtISO).getTime() < Date.now()) {
      showToast('Due date/time must be in the future.', 'warning')
      return
    }
    quickAddSubmitting = true
    try {
      const created = await createTask({
        title: titleTrim,
        status: 'todo',
        priority: 'normal',
        dueAt: dueAtISO,
      })
      tasks = [...tasks, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      quickAddTitle = ''
      quickAddDateTimeStr = ''
      showToast('Task created.', 'notification')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create task', 'error')
    } finally {
      quickAddSubmitting = false
    }
  }

  async function handleCreateTask(event: SubmitEvent) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      showToast(validationError, 'warning')
      return
    }

    const dueAtISO = getDueAtISO()
    if (!dueAtISO) return

    const tagList = tagsInput
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        priority: priority || 'normal',
        owner: owner.trim() || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
        dueAt: dueAtISO,
      }
      const created = await createTask(payload)
      tasks = [...tasks, created].sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      closeCreateModal()
      showToast('Task created.', 'notification')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create task', 'error')
    }
  }

  async function handleEditTask(event: SubmitEvent) {
    event.preventDefault()
    if (editModalTaskId == null) return
    if (!editTitle.trim()) {
      showToast('Title is required.', 'warning')
      return
    }
    const tagList = editTagsInput
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const updated = await updateTask(editModalTaskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        priority: editPriority || 'normal',
        tags: tagList,
      })
      tasks = tasks.map((t) => (t.id === editModalTaskId ? updated : t))
      closeEditModal()
      showToast('Task updated.', 'notification')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update task', 'error')
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      const updated = await updateTaskStatus(taskId, { status: newStatus })
      const next = tasks.map((t) =>
        t.id === taskId ? { ...updated } : t,
      )
      tasks = next.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      showToast('Status updated.', 'notification')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update task status', 'error')
    }
  }

  function handleDeleteTask(taskId: string) {
    openDeleteModal(taskId)
  }

  function formatDate(value: string): string {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const period = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    if (hours === 0) hours = 12
    const hh = String(hours).padStart(2, '0')
    // Display as DD-MM-YYYY hh:mm AM/PM
    return `${day}-${month}-${year} ${hh}:${minutes} ${period}`
  }

  const KANBAN_COLUMNS: { status: TaskStatus; title: string }[] = [
    { status: 'todo', title: 'To do' },
    { status: 'in_progress', title: 'In progress' },
    { status: 'done', title: 'Done' },
  ]

  const KANBAN_FLIP_MS = 150

  /** Tasks for a given column status. Used by dndzone. */
  function tasksForColumn(status: TaskStatus): Task[] {
    return visibleTasks.filter((t) => t.status === status)
  }

  function mergeColumnIntoTasks(status: TaskStatus, items: Task[]) {
    tasks = tasks
      .filter((t) => t.status !== status && !items.some((n) => n.id === t.id))
      .concat(items.map((t) => ({ ...t, status })))
  }

  function handleKanbanConsider(status: TaskStatus, e: CustomEvent<{ items: Task[] }>) {
    mergeColumnIntoTasks(status, e.detail.items as Task[])
  }

  async function handleKanbanFinalize(status: TaskStatus, e: CustomEvent<{ items: Task[] }>) {
    const items = e.detail.items as Task[]
    const previousTasks = [...tasks]
    mergeColumnIntoTasks(status, items)
    for (const item of items) {
      const prev = previousTasks.find((t) => t.id === item.id)
      if (prev && prev.status !== status) {
        try {
          await updateTaskStatus(item.id, { status })
          showToast('Status updated.', 'notification')
        } catch (err) {
          tasks = previousTasks
          showToast(err instanceof Error ? err.message : 'Failed to update status', 'error')
        }
        break
      }
    }
  }

  $: if (viewMode !== 'list' && selectedTaskIds.size > 0) {
    selectedTaskIds = new Set()
  }

  $: if (viewMode === 'list' && !quickAddDateTimeStr?.trim()) {
    quickAddDateTimeStr = toDateTimePickerValue(new Date())
  }

  async function refreshHealth() {
    try {
      const res = await healthReady()
      healthStatus = res.status === 'ready' ? 'ok' : 'degraded'
      healthMessage =
        healthStatus === 'ok' ? '' : 'Service is responding but not fully ready.'
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError({ status: 0, message: 'Service unavailable' })
      healthStatus = 'down'
      healthMessage = err.message
    }
  }

  onMount(() => {
    handleResize()
    const storedTheme = localStorage.getItem('task-theme') as Theme | null
    if (storedTheme === 'light' || storedTheme === 'dark') {
      theme = storedTheme
    }
    const storedFont = localStorage.getItem('task-font-size') as FontSize | null
    if (storedFont === 'normal' || storedFont === 'large' || storedFont === 'xlarge') {
      fontSize = storedFont
    }
    const storedView = localStorage.getItem('task-view-mode') as ViewMode | null
    if (storedView === 'cards' || storedView === 'list' || storedView === 'kanban') {
      viewMode = storedView
    }
    const storedSortKey = localStorage.getItem('task-sort-key') as SortKey | null
    if (storedSortKey === 'due' || storedSortKey === 'title' || storedSortKey === 'priority') {
      sortKey = storedSortKey
    }
    const storedSortAsc = localStorage.getItem('task-sort-ascending')
    if (storedSortAsc === 'true' || storedSortAsc === 'false') {
      sortAscending = storedSortAsc === 'true'
    }
    const storedStatusFilter = localStorage.getItem('task-status-filter') as StatusFilter | null
    if (storedStatusFilter === 'all' || storedStatusFilter === 'todo' || storedStatusFilter === 'in_progress' || storedStatusFilter === 'done') {
      statusFilter = storedStatusFilter
    }
    const storedPriorityFilter = localStorage.getItem('task-priority-filter') as PriorityFilter | null
    if (storedPriorityFilter === 'all' || storedPriorityFilter === 'low' || storedPriorityFilter === 'normal' || storedPriorityFilter === 'high' || storedPriorityFilter === 'urgent') {
      priorityFilter = storedPriorityFilter
    }
    const storedOwnerFilter = localStorage.getItem('task-owner-filter')
    if (typeof storedOwnerFilter === 'string') ownerFilter = storedOwnerFilter
    const storedTagFilter = localStorage.getItem('task-tag-filter')
    if (typeof storedTagFilter === 'string') tagFilter = storedTagFilter
    const storedSearch = localStorage.getItem('task-search-term')
    if (typeof storedSearch === 'string') {
      searchTerm = storedSearch
      debouncedSearchTerm = storedSearch
    }
    const storedFrom = localStorage.getItem('task-filter-from')
    if (typeof storedFrom === 'string') {
      filterFrom = toDisplayDate(storedFrom) || storedFrom
    }
    const storedTo = localStorage.getItem('task-filter-to')
    if (typeof storedTo === 'string') {
      filterTo = toDisplayDate(storedTo) || storedTo
    }
    const storedShowFilters = localStorage.getItem('task-show-filters')
    if (storedShowFilters === 'true' || storedShowFilters === 'false') {
      showFilters = storedShowFilters === 'true'
    }

    applyTheme()
    applyFontSize()
    refreshHealth()
    loadTasks()
  })
</script>

<svelte:window on:keydown={handleGlobalKeydown} on:resize={handleResize} />

<main class="app">
  <header class="app-header">
    <div class="app-header-main">
      <div class="app-header-brand">
        <div class="govuk-logo">
          <img
            src={govLogo}
            alt="GOV.UK"
            class="govuk-logo__crest"
          />
          <span class="govuk-logo__text"></span>
        </div>
        <div>
          <h1>Caseworker task manager</h1>
          <p>Capture, prioritise, and complete casework tasks.</p>
        </div>
      </div>
    </div>

    <div class="app-header-theme" aria-label="Theme and text size">
      <div class="theme-switch">
        <span class="control-label">Theme</span>
        <button
          type="button"
          class={`theme-toggle-switch ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
          on:click={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <span class="theme-toggle-track">
            <span class="theme-toggle-thumb"></span>
          </span>
          <span class="theme-toggle-icons" aria-hidden="true">
            <span class="theme-icon theme-icon--day"></span>
            <span class="theme-icon theme-icon--night"></span>
          </span>
        </button>
      </div>

      <div class="font-size-control">
        <span class="control-label">Text size</span>
        <div class="font-size-buttons" role="radiogroup" aria-label="Text size">
          <button
            type="button"
            class="font-btn font-btn-normal"
            class:selected={fontSize === 'normal'}
            aria-pressed={fontSize === 'normal'}
            on:click={() => setFontSize('normal')}
            title="Normal text size"
          >
            Aa
          </button>
          <button
            type="button"
            class="font-btn font-btn-large"
            class:selected={fontSize === 'large'}
            aria-pressed={fontSize === 'large'}
            on:click={() => setFontSize('large')}
            title="Large text size"
          >
            Aa
          </button>
          <button
            type="button"
            class="font-btn font-btn-xlarge"
            class:selected={fontSize === 'xlarge'}
            aria-pressed={fontSize === 'xlarge'}
            on:click={() => setFontSize('xlarge')}
            title="Extra large text size"
          >
            Aa
          </button>
        </div>
      </div>
    </div>
  </header>

  <div class="task-controls-wrap">
    <div class="task-controls" aria-label="View, search, and sort tasks">
      <div class="task-controls-left">
        {#if isNarrow}
          {#if !mobileSearchExpanded}
            <button
              type="button"
              class="btn-create"
              on:click|preventDefault|stopPropagation={openCreateModal}
              aria-label="Create a new task"
              title="Create a new task"
            >
              Create task
            </button>
            <button
              type="button"
              class="search-toggle-btn"
              on:click|preventDefault|stopPropagation={() => {
                mobileSearchExpanded = true
                tick().then(() => searchInput?.focus())
              }}
              aria-label="Open search"
              title="Search"
            >
              <span class="search-icon" aria-hidden="true"></span>
            </button>
            <button
              type="button"
              class="btn-filter"
              on:click|preventDefault|stopPropagation={toggleFilters}
              aria-expanded={showFilters}
              aria-controls="advanced-filters"
              aria-label="Toggle filters"
              title="Show or hide filters"
            >
              <span class="filter-icon" aria-hidden="true"></span>
            </button>
          {:else}
            <div
              class="search-wrapper search-wrapper--expanded search-wrapper--fullwidth"
              transition:slide={{ duration: 220, easing: cubicOut, axis: 'x' }}
            >
              <span class="search-icon" aria-hidden="true"></span>
              <input
                bind:this={searchInput}
                type="search"
                class="search-input"
                placeholder="Search…"
                bind:value={searchTerm}
                title="Search by title, description, status, or date"
                on:blur={() => {
                  if (isNarrow && !searchTerm.trim()) mobileSearchExpanded = false
                }}
              />
            </div>
          {/if}
        {:else}
          <button
            type="button"
            class="btn-create"
            on:click|preventDefault|stopPropagation={openCreateModal}
            aria-label="Create a new task"
            title="Create a new task"
          >
            Create task
          </button>
          <div class="view-toggle" aria-label="View mode">
            <button
              type="button"
              class:selected={viewMode === 'cards'}
              on:click={() => (viewMode = 'cards')}
              title="Summary view"
            >
              Summary
            </button>
            <button
              type="button"
              class:selected={viewMode === 'list'}
              on:click={() => (viewMode = 'list')}
              title="List view"
            >
              List
            </button>
            <button
              type="button"
              class:selected={viewMode === 'kanban'}
              on:click={() => (viewMode = 'kanban')}
              title="Kanban view"
            >
              Kanban
            </button>
          </div>
          <div class="search-wrapper">
            <span class="search-icon" aria-hidden="true"></span>
            <input
              bind:this={searchInput}
              type="search"
              class="search-input"
              placeholder="Title, description..."
              bind:value={searchTerm}
              title="Search by title, description, status, or date"
            />
          </div>
        {/if}
      </div>
      <div class="task-controls-right">
        {#if !isNarrow}
          <button
            type="button"
            class="btn-filter"
            on:click|preventDefault|stopPropagation={toggleFilters}
            aria-expanded={showFilters}
            aria-controls="advanced-filters"
            aria-label="Toggle filters"
            title="Show or hide filters"
          >
            <span class="filter-icon" aria-hidden="true"></span>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <section class="card">
    {#if healthStatus !== 'ok'}
      <div
        class="health-banner"
        role="status"
        aria-live="polite"
      >
        <span class="health-indicator health-indicator--{healthStatus}"></span>
        <div class="health-text">
          <strong>
            {healthStatus === 'down'
              ? 'The service is currently unavailable.'
              : 'The service may be experiencing issues.'}
          </strong>
          {#if healthMessage}
            <span class="health-message">{healthMessage}</span>
          {/if}
        </div>
        <button type="button" class="health-refresh" on:click={refreshHealth}>
          Retry
        </button>
      </div>
    {/if}
    <div class="card-header">
      <div class="card-header-main">
        {#if loading}
          <span class="badge">Loading…</span>
        {/if}
      </div>
    </div>

    {#if showFilters}
      <div
        id="advanced-filters"
        class="filters-panel"
        role="region"
        aria-label="Advanced filters and sorting"
        transition:slide={{ duration: 220, easing: cubicOut, axis: 'y' }}
      >
        <div class="filter-controls">
          <label>
            <span class="control-label">Status</span>
            <select bind:value={statusFilter} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {#each STATUS_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="control-label">Priority</span>
            <select bind:value={priorityFilter} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              {#each PRIORITY_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="control-label">Owner</span>
            <select bind:value={ownerFilter} aria-label="Filter by owner">
              <option value="">All owners</option>
              {#each uniqueOwners as owner}
                <option value={owner}>{owner}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="control-label">Tag</span>
            <select bind:value={tagFilter} aria-label="Filter by tag">
              <option value="">All tags</option>
              {#each allTags as tag}
                <option value={tag}>{tag}</option>
              {/each}
            </select>
          </label>

          <div class="date-range">
            <label>
              <span class="control-label">Due from</span>
              <SveltyPicker
                mode="date"
                format={DATE_FORMAT}
                formatType="standard"
                bind:value={filterFrom}
                placeholder="DD-MM-YYYY"
                i18n={PICKER_I18N}
                weekStart={1}
                todayBtn
                clearBtn
                manualInput
                inputClasses="filter-due-input"
              />
            </label>
            <label>
              <span class="control-label">Due to</span>
              <SveltyPicker
                mode="date"
                format={DATE_FORMAT}
                formatType="standard"
                bind:value={filterTo}
                placeholder="DD-MM-YYYY"
                i18n={PICKER_I18N}
                weekStart={1}
                todayBtn
                clearBtn
                manualInput
                inputClasses="filter-due-input"
              />
            </label>
          </div>

          <div class="sort-controls">
            <span class="control-label">Sort</span>
            <select bind:value={sortKey} aria-label="Sort tasks by">
              <option value="due">Due date and time</option>
              <option value="title">Title (A–Z)</option>
              <option value="priority">Priority</option>
            </select>
            <button
              type="button"
              class="sort-direction"
              on:click={() => (sortAscending = !sortAscending)}
              aria-label={sortAscending ? 'Sort ascending' : 'Sort descending'}
            >
              {sortAscending ? 'Asc' : 'Des'}
            </button>
          </div>
          {#if hasActiveFilters}
            <button
              type="button"
              class="btn-clear-filters"
              on:click={clearAllFilters}
              aria-label="Clear all filters"
            >
              Clear filters
            </button>
          {/if}
        </div>
      </div>
    {/if}

    {#if tasks.length > 0}
      <div class="metrics-strip" role="status" aria-label="Task due date summary">
        <span class="metric metric--overdue">
          <strong>{overdueCount}</strong> overdue
        </span>
        <span class="metric metric--due-today">
          <strong>{dueTodayCount}</strong> due today
        </span>
        <span class="metric metric--due-soon">
          <strong>{dueThisWeekCount}</strong> due this week
        </span>
      </div>
    {/if}

    {#if tasks.length === 0 && !loading}
      <p class="empty">No tasks yet. Click “Create task” to add one.</p>
    {:else}
      {#if viewMode === 'list'}
        {@const listTasks = listTasksDisplay}
        <div class="list-wrapper" role="region" aria-label="Tasks in list view">
          <form class="quick-add-row" on:submit|preventDefault={handleQuickAdd} aria-label="Quick add task">
            <input
              type="text"
              class="quick-add-title"
              placeholder="Quick add: enter title..."
              bind:value={quickAddTitle}
              aria-label="Task title"
            />
            <div class="quick-add-picker-wrap">
              <SveltyPicker
                mode="datetime"
                format={DATETIME_FORMAT}
                formatType="standard"
                bind:value={quickAddDateTimeStr}
                placeholder="DD-MM-YYYY HH:MM AM/PM"
                i18n={PICKER_I18N}
                weekStart={1}
                todayBtn
                clearBtn
                manualInput
                inputClasses="quick-add-due-input"
              />
            </div>
            <button type="submit" class="btn-quick-add" disabled={quickAddSubmitting}>
              {quickAddSubmitting ? 'Adding…' : 'Add'}
            </button>
          </form>
          {#if selectedTaskIds.size > 0}
            <div class="bulk-actions" role="toolbar" aria-label="Bulk actions for selected tasks">
              <span class="bulk-actions-label">{selectedTaskIds.size} selected</span>
              <div class="bulk-actions-buttons">
                <span class="bulk-status-label">Mark as:</span>
                {#each STATUS_OPTIONS as opt}
                  <button
                    type="button"
                    on:click={() => bulkSetStatus(opt.value)}
                    title={`Mark selected tasks as ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                {/each}
                <button
                  type="button"
                  class="danger"
                  on:click={openBulkDeleteModal}
                  title="Delete selected tasks"
                >
                  Delete selected
                </button>
                <button type="button" class="btn-clear-selection" on:click={clearListSelection}>
                  Clear selection
                </button>
              </div>
            </div>
          {/if}
          {#if !isNarrow && visibleTasks.length > listTasksDisplay.length}
            <div class="list-select-all-bar" role="status">
              {#if allVisibleTasksSelected}
                <span class="list-select-all-text">All {visibleTasks.length} tasks selected.</span>
                <button type="button" class="list-select-all-link" on:click={clearListSelection}>
                  Clear selection
                </button>
              {:else}
                <span class="list-select-all-text">{visibleTasks.length} tasks in list.</span>
                <button
                  type="button"
                  class="list-select-all-link"
                  on:click={selectAllInListView}
                  aria-label="Select all {visibleTasks.length} tasks in list"
                >
                  Select all {visibleTasks.length} tasks in list
                </button>
              {/if}
            </div>
          {/if}
          <table class="task-table">
            <thead>
              <tr>
                <th scope="col" class="col-select">
                  <label class="select-all-label">
                    <input
                      type="checkbox"
                      aria-label={!isNarrow && visibleTasks.length > listTasksDisplay.length
                        ? 'Select all on this page'
                        : 'Select all tasks in list'}
                      checked={listTasks.length > 0 && selectedTaskIds.size === listTasks.length}
                      use:setIndeterminate={isSelectAllIndeterminate}
                      on:change={selectAllInList}
                    />
                  </label>
                </th>
                <th scope="col">Title</th>
                <th scope="col">Priority</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Due</th>
                <th scope="col">Tags</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#if listTasks.length === 0}
                <tr>
                  <td colspan="9" class="empty-cell">No tasks match your current search or filters.</td>
                </tr>
              {:else}
              {#each listTasks as taskItem}
                <tr class:row-selected={selectedTaskIds.has(taskItem.id)}>
                  <td class="col-select">
                    <label class="row-select-label">
                      <input
                        type="checkbox"
                        aria-label={`Select ${taskItem.title}`}
                        checked={selectedTaskIds.has(taskItem.id)}
                        on:change={() => toggleTaskSelection(taskItem.id)}
                      />
                    </label>
                  </td>
                  <td>{taskItem.title}</td>
                  <td>
                    <span class="priority-badge priority-{taskItem.priority ?? 'normal'}">
                      {priorityLabel(taskItem.priority ?? 'normal')}
                    </span>
                  </td>
                  <td>{taskItem.owner ?? '—'}</td>
                  <td>{statusLabel(taskItem.status)}</td>
                  <td>{formatDate(taskItem.dueAt)}</td>
                  <td>
                    {#if (taskItem.tags ?? []).length > 0}
                      <span class="tag-chips">
                        {#each (taskItem.tags ?? []) as tag}
                          <button
                            type="button"
                            class="tag-chip"
                            on:click={() => filterByTag(tag)}
                            title="Filter by this tag"
                          >
                            {tag}
                          </button>
                        {/each}
                      </span>
                    {:else}
                      —
                    {/if}
                  </td>
                  <td>{formatDate(taskItem.createdAt)}</td>
                  <td class="table-actions">
                    <button
                      type="button"
                      on:click={() => openEditModal(taskItem)}
                      title="Edit task"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="danger"
                      on:click={() => handleDeleteTask(taskItem.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
              {/if}
            </tbody>
          </table>
          {#if !isNarrow && visibleTasks.length > 0}
            <nav class="list-pagination" aria-label="List pagination">
              <div class="list-pagination-info">
                Showing {(listPage - 1) * listPageSize + 1}–{Math.min(listPage * listPageSize, visibleTasks.length)} of {visibleTasks.length}
              </div>
              <div class="list-pagination-controls">
                <button
                  type="button"
                  class="pagination-btn"
                  disabled={listPage <= 1}
                  aria-label="Previous page"
                  on:click={() => (listPage = Math.max(1, listPage - 1))}
                >
                  Previous
                </button>
                <span class="pagination-page" aria-current="page">
                  Page {listPage} of {totalListPages}
                </span>
                <button
                  type="button"
                  class="pagination-btn"
                  disabled={listPage >= totalListPages}
                  aria-label="Next page"
                  on:click={() => (listPage = Math.min(totalListPages, listPage + 1))}
                >
                  Next
                </button>
              </div>
              <div class="list-pagination-size">
                <label for="list-page-size">
                  <span class="control-label">Per page</span>
                </label>
                <select
                  id="list-page-size"
                  value={listPageSize}
                  aria-label="Tasks per page"
                  on:change={(e) => {
                    const v = Number((e.currentTarget as HTMLSelectElement).value)
                    if (LIST_PAGE_SIZES.includes(v as ListPageSize)) {
                      listPageSize = v as ListPageSize
                      listPage = 1
                    }
                  }}
                >
                  {#each LIST_PAGE_SIZES as size}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
            </nav>
          {/if}
        </div>
      {:else if viewMode === 'kanban'}
        <div class="kanban" role="region" aria-label="Tasks in kanban view">
          {#each KANBAN_COLUMNS as column}
            <section
              class="kanban-column"
              role="list"
              aria-label={column.title}
            >
              <header class="kanban-column-header">
                <h3>{column.title}</h3>
                <span class="badge">
                  {visibleTasks.filter((t) => t.status === column.status).length}
                </span>
              </header>
              <div
                class="kanban-column-body"
                use:dndzone={{
                  items: tasksForColumn(column.status),
                  flipDurationMs: KANBAN_FLIP_MS,
                  type: 'kanban',
                }}
                on:consider={(e) => handleKanbanConsider(column.status, e)}
                on:finalize={(e) => handleKanbanFinalize(column.status, e)}
                aria-label={column.title}
              >
                {#each tasksForColumn(column.status) as task (task.id)}
                  <article
                    class="task kanban-task"
                    role="listitem"
                    aria-label={task.title}
                    animate:flip={{ duration: KANBAN_FLIP_MS }}
                  >
                    <h4>{task.title}</h4>
                    <div class="kanban-card-badges">
                      <span class={`status status-${task.status}`}>
                        {statusLabel(task.status)}
                      </span>
                      <span class="priority-badge priority-{task.priority ?? 'normal'}">
                        {priorityLabel(task.priority ?? 'normal')}
                      </span>
                    </div>
                    {#if task.owner}
                      <p class="task-owner">{task.owner}</p>
                    {/if}
                    {#if task.description}
                      <p class="task-description">{task.description}</p>
                    {/if}
                    {#if (task.tags ?? []).length > 0}
                      <div class="tag-chips">
                        {#each (task.tags ?? []) as tag}
                          <button
                            type="button"
                            class="tag-chip"
                            on:click|stopPropagation={() => filterByTag(tag)}
                            title="Filter by this tag"
                          >
                            {tag}
                          </button>
                        {/each}
                      </div>
                    {/if}
                    <dl class="meta">
                      <div>
                        <dt>Due</dt>
                        <dd>{formatDate(task.dueAt)}</dd>
                      </div>
                    </dl>
                    <div class="task-actions">
                      <button
                        type="button"
                        on:click|stopPropagation={() => openEditModal(task)}
                        title="Edit task"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="danger"
                        on:click|stopPropagation={() => handleDeleteTask(task.id)}
                        title={`Delete task ${task.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                {:else}
                  <p class="kanban-empty">Drop tasks here or add via Create task.</p>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {:else}
        <div class="tasks-grid" role="region" aria-label="Tasks in summary cards view">
          {#if visibleTasks.length === 0}
            <p class="empty">No tasks match your current search or filters.</p>
          {:else}
          {#each visibleTasks as taskItem}
            <article class="task">
              <header class="task-header">
                <h3>{taskItem.title}</h3>
                <span class="priority-badge priority-{taskItem.priority ?? 'normal'}">
                  {priorityLabel(taskItem.priority ?? 'normal')}
                </span>
                <span class={`status status-${taskItem.status}`}>
                  {statusLabel(taskItem.status)}
                </span>
              </header>
              {#if taskItem.owner}
                <p class="task-owner">Owner: {taskItem.owner}</p>
              {/if}
              {#if taskItem.description}
                <p class="task-description">
                  {taskItem.description}
                </p>
              {/if}
              {#if (taskItem.tags ?? []).length > 0}
                <div class="tag-chips">
                  {#each (taskItem.tags ?? []) as tag}
                    <button
                      type="button"
                      class="tag-chip"
                      on:click={() => filterByTag(tag)}
                      title="Filter by this tag"
                    >
                      {tag}
                    </button>
                  {/each}
                </div>
              {/if}

              <dl class="meta">
                <div>
                  <dt>Due</dt>
                  <dd>{formatDate(taskItem.dueAt)}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(taskItem.createdAt)}</dd>
                </div>
              </dl>

              <div class="task-actions">
                <button
                  type="button"
                  on:click={() => openEditModal(taskItem)}
                  title="Edit task"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="danger"
                  on:click={() => handleDeleteTask(taskItem.id)}
                  title={`Delete task ${taskItem.title}`}
                >
                  Delete
                </button>
              </div>
            </article>
          {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </section>

  {#if createModalOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-backdrop"
      class:modal-backdrop--drawer={isNarrow}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={(e) => e.key === 'Escape' && closeCreateModal()}
      transition:fade={{ duration: 200 }}
    >
      <div
        class="modal"
        class:modal--drawer={isNarrow}
        role="document"
        on:keydown={(e) => e.key === 'Escape' && closeCreateModal()}
        transition:modalContentTransition={{ isNarrow }}
      >
        <div class="modal-header">
          <h2 id="modal-title">Create a new task</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close"
            on:click={closeCreateModal}
          >
            ×
          </button>
        </div>

        <form class="task-form" on:submit|preventDefault={handleCreateTask}>
          <div class="field">
            <label for="modal-title-input">Title<span class="required">*</span></label>
            <input
              bind:this={modalFirstInput}
              id="modal-title-input"
              type="text"
              bind:value={title}
              placeholder="e.g. Review case bundle"
              required
            />
          </div>

          <div class="field">
            <label for="modal-description">Description</label>
            <textarea
              id="modal-description"
              rows="3"
              bind:value={description}
              placeholder="Optional context or notes for this task"
            ></textarea>
          </div>

          <div class="field">
            <label for="modal-status">Status<span class="required">*</span></label>
            <select id="modal-status" bind:value={status}>
              {#each STATUS_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="modal-priority">Priority</label>
            <select id="modal-priority" bind:value={priority}>
              {#each PRIORITY_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="modal-owner">Owner</label>
            <input
              id="modal-owner"
              type="text"
              bind:value={owner}
              placeholder="e.g. Caseworker A"
            />
          </div>

          <div class="field">
            <label for="modal-tags">Tags (comma-separated)</label>
            <input
              id="modal-tags"
              type="text"
              bind:value={tagsInput}
              placeholder="e.g. evidence, hearing"
            />
          </div>

          <div class="field-group">
            <div class="field">
              <label for="modal-due-datetime">Due date and time (DD-MM-YYYY, 12-hour)<span class="required">*</span></label>
              <SveltyPicker
                inputId="modal-due-datetime"
                mode="datetime"
                format={DATETIME_FORMAT}
                formatType="standard"
                bind:value={dueDateTimeStr}
                placeholder="DD-MM-YYYY HH:MM AM/PM"
                required
                i18n={PICKER_I18N}
                weekStart={1}
                todayBtn
                clearBtn
                manualInput
                inputClasses="modal-due-input"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="button" on:click={closeCreateModal}>Cancel</button>
            <button type="submit">Create task</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if editModalTaskId !== null}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-backdrop"
      class:modal-backdrop--drawer={isNarrow}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={(e) => e.key === 'Escape' && closeEditModal()}
      transition:fade={{ duration: 200 }}
    >
      <div
        class="modal"
        class:modal--drawer={isNarrow}
        role="document"
        on:keydown={(e) => e.key === 'Escape' && closeEditModal()}
        transition:modalContentTransition={{ isNarrow }}
      >
        <div class="modal-header">
          <h2 id="edit-modal-title">Edit task</h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close"
            on:click={closeEditModal}
          >
            ×
          </button>
        </div>

        <form class="task-form" on:submit|preventDefault={handleEditTask}>
          <div class="field">
            <label for="edit-title-input">Title<span class="required">*</span></label>
            <input
              bind:this={editModalFirstInput}
              id="edit-title-input"
              type="text"
              bind:value={editTitle}
              placeholder="e.g. Review case bundle"
              required
            />
          </div>

          <div class="field">
            <label for="edit-status">Status</label>
            <select id="edit-status" bind:value={editStatus}>
              {#each STATUS_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="edit-description">Description</label>
            <textarea
              id="edit-description"
              rows="3"
              bind:value={editDescription}
              placeholder="Optional context or notes"
            ></textarea>
          </div>

          <div class="field">
            <label for="edit-priority">Priority</label>
            <select id="edit-priority" bind:value={editPriority}>
              {#each PRIORITY_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="edit-tags">Tags (comma-separated)</label>
            <input
              id="edit-tags"
              type="text"
              bind:value={editTagsInput}
              placeholder="e.g. evidence, hearing"
            />
          </div>

          <div class="form-actions">
            <button type="button" on:click={closeEditModal}>Cancel</button>
            <button type="submit">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if deleteModalTaskIds !== null && deleteModalTaskIds.length > 0}
    {@const tasksToDelete = tasks.filter((t) => deleteModalTaskIds?.includes(t.id) ?? false)}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      tabindex="-1"
      on:click={handleModalBackdropClick}
      on:keydown={(e) => e.key === 'Escape' && closeDeleteModal()}
      transition:fade={{ duration: 200 }}
    >
      <div
        class="modal modal--delete"
        role="document"
        on:keydown={(e) => e.key === 'Escape' && closeDeleteModal()}
        transition:fade={{ duration: 200 }}
      >
        <div class="modal-header">
          <h2 id="delete-modal-title">
            {tasksToDelete.length === 1 ? 'Delete task?' : `Delete ${tasksToDelete.length} tasks?`}
          </h2>
          <button
            type="button"
            class="modal-close"
            aria-label="Close"
            on:click={closeDeleteModal}
          >
            ×
          </button>
        </div>
        <div class="modal-body">
          {#if tasksToDelete.length === 1}
            {@const one = tasksToDelete[0]}
            <p>
              {one.status !== 'done'
                ? 'This task is not marked as done. Are you sure you want to permanently delete it?'
                : 'Are you sure you want to permanently delete this task?'}
            </p>
            <p class="modal-task-title"><strong>{one.title}</strong></p>
          {:else if tasksToDelete.length > 1}
            <p>Are you sure you want to permanently delete the following tasks?</p>
            <ul class="modal-task-list">
              {#each tasksToDelete as t}
                <li>{t.title}</li>
              {/each}
            </ul>
          {:else}
            <p>No tasks to delete. They may have been deleted already.</p>
          {/if}
        </div>
        <div class="modal-actions">
          <button type="button" on:click={closeDeleteModal}>Cancel</button>
          <button
            type="button"
            class="danger"
            on:click={performDeleteTask}
            disabled={tasksToDelete.length === 0}
          >
            {tasksToDelete.length === 1 ? 'Delete task' : 'Delete tasks'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <div class="toast-container" role="region" aria-label="Notifications">
    {#each toasts as toast (toast.id)}
      <div
        class="toast toast--{toast.type}"
        class:toast--exiting={toast.exiting}
        role="alert"
        data-toast-id={toast.id}
      >
        <span class="toast-message">{toast.message}</span>
        <button
          type="button"
          class="toast-close"
          aria-label="Dismiss"
          on:click={() => dismissToast(toast.id)}
        >
          ×
        </button>
      </div>
    {/each}
  </div>
</main>


