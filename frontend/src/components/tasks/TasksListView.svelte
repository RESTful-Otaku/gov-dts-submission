<script lang="ts">
  import SveltyPicker from 'svelty-picker'
  import type { Action } from 'svelte/action'
  import type { i18nType } from 'svelty-picker/i18n'
  import type { OnboardingStepId } from '../../lib/app/onboarding/types'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import ListPagination from './ListPagination.svelte'
  import TaskListRow from './TaskListRow.svelte'

  export let isNarrow: boolean
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
</script>

<div class="list-wrapper" role="region" aria-label="Tasks in list view" data-tour="pick-task">
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
    <button type="submit" class="btn-quick-add btn-icon-compact" disabled={quickAddSubmitting} aria-label="Add task">
      <span class="btn-icon-compact__icon" aria-hidden="true">{quickAddSubmitting ? '⏳' : '＋'}</span>
      <span class="btn-icon-compact__label">{quickAddSubmitting ? 'Adding…' : 'Add'}</span>
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
            class="btn-icon-compact"
            on:click={() => bulkSetStatus(opt.value)}
            title={`Mark selected tasks as ${opt.label}`}
            aria-label={`Mark selected tasks as ${opt.label}`}
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
          title="Delete selected tasks"
          aria-label="Delete selected tasks"
        >
          <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
          <span class="btn-icon-compact__label">Delete selected</span>
        </button>
        <button type="button" class="btn-clear-selection btn-icon-compact" on:click={clearListSelection} aria-label="Clear selection">
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">Clear selection</span>
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
        <th scope="col" class="col-select" data-tour={tourSpotlightStepId === 'list_multiselect' ? 'tour-list-select' : undefined}>
          <label class="select-all-label">
            <input
              type="checkbox"
              aria-label={!isNarrow && visibleTasks.length > listTasksDisplay.length
                ? 'Select all on this page'
                : 'Select all tasks in list'}
              checked={listTasksDisplay.length > 0 && selectedTaskIds.size === listTasksDisplay.length}
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
      {#if listTasksDisplay.length === 0}
        <tr>
          <td colspan="9" class="empty-cell">No tasks match your current search or filters.</td>
        </tr>
      {:else}
      {#each listTasksDisplay as taskItem}
        <TaskListRow
          {taskItem}
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

