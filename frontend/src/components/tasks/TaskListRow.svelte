<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import TagChips from './TagChips.svelte'
  import TaskPriorityBadge from './TaskPriorityBadge.svelte'

  export let taskItem: Task
  export let canMutateTasks = true
  export let selected: boolean
  export let toggleTaskSelection: (id: string) => void
  export let openEditModal: (task: Task) => void
  export let handleDeleteTask: (taskId: string) => void
  export let filterByTag: (tag: string) => void
  export let priorityLabel: (p: TaskPriority) => string
  export let statusLabel: (s: TaskStatus) => string
  export let formatDate: (value: string) => string
  export let tourOpenSpotlight = false
  export let tourEditSpotlight = false
  export let tourDeleteSpotlight = false

  function handleToggleSelection(): void {
    toggleTaskSelection(taskItem.id)
  }

  function handleEditClick(): void {
    openEditModal(taskItem)
  }

  function handleDeleteClick(): void {
    handleDeleteTask(taskItem.id)
  }
</script>

<tr class:row-selected={selected}>
  {#if canMutateTasks}
    <td class="col-select">
      <label class="row-select-label">
        <input
          type="checkbox"
          aria-label={`Select ${taskItem.title}`}
          checked={selected}
          on:change={handleToggleSelection}
        />
      </label>
    </td>
  {/if}
  <td>{taskItem.title}</td>
  <td>
    <TaskPriorityBadge
      priority={taskItem.priority}
      label={priorityLabel(taskItem.priority ?? 'normal')}
    />
  </td>
  <td>{taskItem.owner ?? UI_COPY.common.noDataDash}</td>
  <td>{statusLabel(taskItem.status)}</td>
  <td>{formatDate(taskItem.dueAt)}</td>
  <td>
    {#if (taskItem.tags ?? []).length > 0}
      <TagChips wrapper="span" tags={taskItem.tags ?? []} onTagClick={filterByTag} />
    {:else}
      {UI_COPY.common.noDataDash}
    {/if}
  </td>
  <td>{formatDate(taskItem.createdAt)}</td>
  {#if canMutateTasks}
    <td class="table-actions">
      <button
        type="button"
        class="btn-icon-compact"
        data-tour={tourOpenSpotlight ? 'tour-spot-open' : tourEditSpotlight ? 'tour-spot-edit' : undefined}
        on:click={handleEditClick}
        title={UI_COPY.common.editTask}
        aria-label={UI_COPY.common.edit}
      >
        <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
        <span class="btn-icon-compact__label">{UI_COPY.common.edit}</span>
      </button>
      <button
        type="button"
        class="danger btn-icon-compact"
        data-tour={tourDeleteSpotlight ? 'tour-spot-delete' : undefined}
        on:click={handleDeleteClick}
        title={UI_COPY.common.deleteTask}
        aria-label={UI_COPY.common.delete}
      >
        <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
        <span class="btn-icon-compact__label">{UI_COPY.common.delete}</span>
      </button>
    </td>
  {/if}
</tr>
