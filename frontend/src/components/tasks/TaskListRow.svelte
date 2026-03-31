<script lang="ts">
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import TagChips from './TagChips.svelte'
  import TaskPriorityBadge from './TaskPriorityBadge.svelte'

  export let taskItem: Task
  export let selected: boolean
  export let toggleTaskSelection: (id: string) => void
  export let openEditModal: (task: Task) => void
  export let handleDeleteTask: (taskId: string) => void
  export let filterByTag: (tag: string) => void
  export let priorityLabel: (p: TaskPriority) => string
  export let statusLabel: (s: TaskStatus) => string
  export let formatDate: (value: string) => string
</script>

<tr class:row-selected={selected}>
  <td class="col-select">
    <label class="row-select-label">
      <input
        type="checkbox"
        aria-label={`Select ${taskItem.title}`}
        checked={selected}
        on:change={() => toggleTaskSelection(taskItem.id)}
      />
    </label>
  </td>
  <td>{taskItem.title}</td>
  <td>
    <TaskPriorityBadge
      priority={taskItem.priority}
      label={priorityLabel(taskItem.priority ?? 'normal')}
    />
  </td>
  <td>{taskItem.owner ?? '—'}</td>
  <td>{statusLabel(taskItem.status)}</td>
  <td>{formatDate(taskItem.dueAt)}</td>
  <td>
    {#if (taskItem.tags ?? []).length > 0}
      <TagChips wrapper="span" tags={taskItem.tags ?? []} onTagClick={filterByTag} />
    {:else}
      —
    {/if}
  </td>
  <td>{formatDate(taskItem.createdAt)}</td>
  <td class="table-actions">
    <button type="button" class="btn-icon-compact" on:click={() => openEditModal(taskItem)} title="Edit task" aria-label="Edit">
      <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
      <span class="btn-icon-compact__label">Edit</span>
    </button>
    <button
      type="button"
      class="danger btn-icon-compact"
      on:click={() => handleDeleteTask(taskItem.id)}
      title="Delete task"
      aria-label="Delete"
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
      <span class="btn-icon-compact__label">Delete</span>
    </button>
  </td>
</tr>
