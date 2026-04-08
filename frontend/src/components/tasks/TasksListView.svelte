<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  import type { SortKey } from '../../lib/app/types'
  import { tableSortGlyph } from '../../lib/ui/tableSortGlyph'
  import SveltyPicker from 'svelty-picker'
  import type { Action } from 'svelte/action'
  import type { i18nType } from 'svelty-picker/i18n'
  import type { OnboardingStepId } from '../../lib/app/onboarding/types'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import ListPagination from './ListPagination.svelte'
  import TaskListRow from './TaskListRow.svelte'

  export let isNarrow: boolean
  export let canMutateTasks = true
  export let visibleTasks: Task[]
  export let listTasksDisplay: Task[]
  export let selectedTaskIds: Set<string>
  export let isSelectAllIndeterminate: boolean
  export let allVisibleTasksSelected: boolean

  export let totalListPages: number
  export let LIST_PAGE_SIZES: readonly number[]
  export let STATUS_OPTIONS: { value: TaskStatus; label: string }[]

  export let listPage: number
  export let listPageSize: number

  export let quickAddTitle: string
  export let quickAddDateTimeStr: string
  export let quickAddSubmitting: boolean

  export let DATETIME_FORMAT: string
  export let PICKER_I18N: i18nType

  export let setIndeterminate: Action<HTMLInputElement, boolean>

  export let handleQuickAdd: (event: SubmitEvent) => void | Promise<void>
  export let toggleTaskSelection: (id: string) => void
  export let selectAllInList: () => void
  export let selectAllInListView: () => void
  export let clearListSelection: () => void
  export let bulkSetStatus: (newStatus: TaskStatus) => void | Promise<void>
  export let openBulkDeleteModal: () => void
  export let openEditModal: (task: Task) => void
  export let handleDeleteTask: (taskId: string) => void
  export let filterByTag: (tag: string) => void

  export let priorityLabel: (p: TaskPriority) => string
  export let statusLabel: (s: TaskStatus) => string
  export let formatDate: (value: string) => string
  export let tourSpotlightStepId: OnboardingStepId | null = null
  export let tourAnchorTaskId: string | null = null

  export let sortKey: SortKey
  export let sortAscending: boolean
  export let onSortColumn: (key: SortKey) => void

  type BulkStatusHandlerMap = Partial<Record<TaskStatus, () => void>>
  let bulkStatusHandlers: BulkStatusHandlerMap = {}

  $: bulkStatusHandlers = Object.fromEntries(
    STATUS_OPTIONS.map((opt) => [opt.value, () => bulkSetStatus(opt.value)]),
  ) as BulkStatusHandlerMap
</script>

<div class="list-wrapper" role="region" aria-label={UI_COPY.tasks.views.listRegionAria} data-tour="pick-task">
  {#if canMutateTasks}
  <form class="quick-add-row" on:submit|preventDefault={handleQuickAdd} aria-label={UI_COPY.tasks.views.quickAddAria}>
    <input
      type="text"
      class="quick-add-title"
      placeholder={UI_COPY.tasks.views.quickAddPlaceholder}
      bind:value={quickAddTitle}
      aria-label={UI_COPY.tasks.views.quickAddTitleAria}
    />
    <div class="quick-add-picker-wrap">
      <SveltyPicker
        mode="datetime"
        format={DATETIME_FORMAT}
        formatType="standard"
        bind:value={quickAddDateTimeStr}
        placeholder={UI_COPY.tasks.views.quickAddDatePlaceholder}
        i18n={PICKER_I18N}
        weekStart={1}
        todayBtn
        clearBtn
        manualInput
        inputClasses="quick-add-due-input"
      />
    </div>
    <button type="submit" class="btn-quick-add btn-icon-compact" disabled={quickAddSubmitting} aria-label={UI_COPY.tasks.views.quickAddButtonAria}>
      <span class="btn-icon-compact__icon" aria-hidden="true">{quickAddSubmitting ? '⏳' : '＋'}</span>
      <span class="btn-icon-compact__label">{quickAddSubmitting ? UI_COPY.tasks.views.quickAddAdding : UI_COPY.tasks.views.quickAddAdd}</span>
    </button>
  </form>
  {/if}
  {#if canMutateTasks && selectedTaskIds.size > 0}
    <div class="bulk-actions" role="toolbar" aria-label={UI_COPY.tasks.views.bulkActionsAria}>
      <span class="bulk-actions-label">{selectedTaskIds.size} {UI_COPY.tasks.views.selectedSuffix}</span>
      <div class="bulk-actions-buttons">
        <span class="bulk-status-label">{UI_COPY.tasks.views.markAs}</span>
        {#each STATUS_OPTIONS as opt}
          <button
            type="button"
            class="btn-icon-compact"
            on:click={bulkStatusHandlers[opt.value]}
            title={`${UI_COPY.tasks.views.markSelectedPrefix}${opt.label}`}
            aria-label={`${UI_COPY.tasks.views.markSelectedPrefix}${opt.label}`}
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">✓</span>
            <span class="btn-icon-compact__label">{opt.label}</span>
          </button>
        {/each}
        <button
          type="button"
          class="danger btn-icon-compact"
          data-tour={tourSpotlightStepId === 'list_bulk_delete' ? 'tour-list-bulk-delete' : undefined}
          on:click={openBulkDeleteModal}
          title={UI_COPY.tasks.views.deleteSelectedAria}
          aria-label={UI_COPY.tasks.views.deleteSelectedAria}
        >
          <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
          <span class="btn-icon-compact__label">{UI_COPY.tasks.views.deleteSelected}</span>
        </button>
        <button type="button" class="btn-clear-selection btn-icon-compact" on:click={clearListSelection} aria-label={UI_COPY.tasks.views.clearSelectionAria}>
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">{UI_COPY.tasks.views.clearSelection}</span>
        </button>
      </div>
    </div>
  {/if}
  {#if canMutateTasks && !isNarrow && visibleTasks.length > listTasksDisplay.length}
    <div class="list-select-all-bar" role="status">
      {#if allVisibleTasksSelected}
        <span class="list-select-all-text">{UI_COPY.tasks.views.allSelectedPrefix}{visibleTasks.length}{UI_COPY.tasks.views.allSelectedSuffix}</span>
        <button type="button" class="list-select-all-link" on:click={clearListSelection}>
          {UI_COPY.tasks.views.clearSelection}
        </button>
      {:else}
        <span class="list-select-all-text">{visibleTasks.length}{UI_COPY.tasks.views.tasksInListSuffix}</span>
        <button
          type="button"
          class="list-select-all-link"
          on:click={selectAllInListView}
          aria-label={`${UI_COPY.tasks.views.selectAllInListPrefix}${visibleTasks.length}${UI_COPY.tasks.views.selectAllInListSuffix}`}
        >
          {UI_COPY.tasks.views.selectAllInListPrefix}{visibleTasks.length}{UI_COPY.tasks.views.selectAllInListSuffix}
        </button>
      {/if}
    </div>
  {/if}
  <table class="task-table">
    <thead>
      <tr>
        {#if canMutateTasks}
          <th scope="col" class="col-select" data-tour={tourSpotlightStepId === 'list_multiselect' ? 'tour-list-select' : undefined}>
            <label class="select-all-label">
              <input
                type="checkbox"
                aria-label={!isNarrow && visibleTasks.length > listTasksDisplay.length
                  ? UI_COPY.tasks.views.selectAllOnPage
                  : UI_COPY.tasks.views.selectAllTasksInList}
                checked={listTasksDisplay.length > 0 && selectedTaskIds.size === listTasksDisplay.length}
                use:setIndeterminate={isSelectAllIndeterminate}
                on:change={selectAllInList}
              />
            </label>
          </th>
        {/if}
        <th
          scope="col"
          aria-sort={sortKey === 'title' ? (sortAscending ? 'ascending' : 'descending') : 'none'}
        >
          <button type="button" class="th-sort" on:click={() => onSortColumn('title')}>
            {UI_COPY.tasks.views.tableTitle}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'title', sortAscending)}</span>
          </button>
        </th>
        <th
          scope="col"
          aria-sort={sortKey === 'priority' ? (sortAscending ? 'ascending' : 'descending') : 'none'}
        >
          <button type="button" class="th-sort" on:click={() => onSortColumn('priority')}>
            {UI_COPY.tasks.views.tablePriority}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'priority', sortAscending)}</span>
          </button>
        </th>
        <th
          scope="col"
          aria-sort={sortKey === 'owner' ? (sortAscending ? 'ascending' : 'descending') : 'none'}
        >
          <button type="button" class="th-sort" on:click={() => onSortColumn('owner')}>
            {UI_COPY.tasks.views.tableOwner}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'owner', sortAscending)}</span>
          </button>
        </th>
        <th
          scope="col"
          aria-sort={sortKey === 'status' ? (sortAscending ? 'ascending' : 'descending') : 'none'}
        >
          <button type="button" class="th-sort" on:click={() => onSortColumn('status')}>
            {UI_COPY.tasks.views.tableStatus}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'status', sortAscending)}</span>
          </button>
        </th>
        <th scope="col" aria-sort={sortKey === 'due' ? (sortAscending ? 'ascending' : 'descending') : 'none'}>
          <button type="button" class="th-sort" on:click={() => onSortColumn('due')}>
            {UI_COPY.tasks.views.tableDue}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'due', sortAscending)}</span>
          </button>
        </th>
        <th scope="col" aria-sort={sortKey === 'tags' ? (sortAscending ? 'ascending' : 'descending') : 'none'}>
          <button type="button" class="th-sort" on:click={() => onSortColumn('tags')}>
            {UI_COPY.tasks.views.tableTags}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'tags', sortAscending)}</span>
          </button>
        </th>
        <th scope="col" aria-sort={sortKey === 'created' ? (sortAscending ? 'ascending' : 'descending') : 'none'}>
          <button type="button" class="th-sort" on:click={() => onSortColumn('created')}>
            {UI_COPY.tasks.views.tableCreated}{' '}
            <span class="th-sort__glyph" aria-hidden="true">{tableSortGlyph(sortKey === 'created', sortAscending)}</span>
          </button>
        </th>
        {#if canMutateTasks}
          <th scope="col">{UI_COPY.tasks.views.tableActions}</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#if listTasksDisplay.length === 0}
        <tr>
          <td colspan={canMutateTasks ? 9 : 7} class="empty-cell">{UI_COPY.tasks.views.emptyState}</td>
        </tr>
      {:else}
      {#each listTasksDisplay as taskItem}
        <TaskListRow
          {taskItem}
          {canMutateTasks}
          selected={selectedTaskIds.has(taskItem.id)}
          tourOpenSpotlight={tourAnchorTaskId === taskItem.id && tourSpotlightStepId === 'open_task_reader'}
          tourEditSpotlight={tourAnchorTaskId === taskItem.id && tourSpotlightStepId === 'edit_task'}
          tourDeleteSpotlight={tourAnchorTaskId === taskItem.id && tourSpotlightStepId === 'delete_task'}
          {toggleTaskSelection}
          {openEditModal}
          {handleDeleteTask}
          {filterByTag}
          {priorityLabel}
          {statusLabel}
          {formatDate}
        />
      {/each}
      {/if}
    </tbody>
  </table>
  {#if !isNarrow && visibleTasks.length > 0}
    <ListPagination
      bind:listPage
      bind:listPageSize
      {totalListPages}
      visibleCount={visibleTasks.length}
      {LIST_PAGE_SIZES}
    />
  {/if}
</div>

