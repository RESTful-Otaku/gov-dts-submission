<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import ModalHeader from '../modals/ModalHeader.svelte'
  import TaskCardActions from './TaskCardActions.svelte'
  import TaskPriorityBadge from './TaskPriorityBadge.svelte'
  import TaskStatusBadge from './TaskStatusBadge.svelte'

  export let isNarrow: boolean
  /** Same transition as create/edit modals (fade on web, slide drawer on narrow). */
  export let modalContentTransition: (node: HTMLElement, params: { isNarrow?: boolean }) => any

  export let task: Task
  export let onClose: () => void
  export let onEdit: () => void
  export let onDelete: () => void
  export let priorityLabel: (p: TaskPriority) => string
  export let statusLabel: (s: TaskStatus) => string
  export let formatDate: (value: string) => string

  /**
   * Tap-to-open runs pointerup first, then the browser fires a synthetic click on the
   * element under the cursor — which becomes this full-screen backdrop and would close
   * the dialog immediately. Ignore backdrop dismissal until that click has passed.
   */
  let backdropDismissEnabled = false

  onMount(() => {
    const id = window.setTimeout(() => {
      backdropDismissEnabled = true
    }, 200)
    return () => window.clearTimeout(id)
  })

  function onBackdropClick(e: MouseEvent): void {
    if (!backdropDismissEnabled) return
    if (e.target === e.currentTarget) onClose()
  }

  $: tagsJoined = (task.tags ?? []).join(', ')
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop"
  class:modal-backdrop--drawer={isNarrow}
  data-tour="task-reader"
  role="dialog"
  aria-modal="true"
  aria-labelledby="task-reader-title"
  tabindex="-1"
  on:click={onBackdropClick}
  on:keydown={(e) => e.key === 'Escape' && onClose()}
  transition:fade={{ duration: 200 }}
>
  <div
    class="modal modal--reader"
    class:modal--drawer={isNarrow}
    role="document"
    on:click|stopPropagation
    on:keydown={(e) => e.key === 'Escape' && onClose()}
    transition:modalContentTransition={{ isNarrow }}
  >
    <ModalHeader titleId="task-reader-title" title="View task" onClose={onClose} />

    <div class="task-form task-readonly-form" aria-label="Task details (read-only)">
      <div class="field">
        <span class="task-readonly-label">Title</span>
        <p class="task-readonly-value task-readonly-value--title">{task.title}</p>
      </div>

      <div class="field">
        <span id="task-reader-status-label" class="task-readonly-label">Status</span>
        <div class="task-readonly-control" role="group" aria-labelledby="task-reader-status-label">
          <TaskStatusBadge status={task.status} label={statusLabel(task.status)} />
        </div>
      </div>

      <div class="field">
        <span class="task-readonly-label">Description</span>
        <p class="task-readonly-value task-readonly-value--multiline">{task.description ?? ''}</p>
      </div>

      <div class="field">
        <span id="task-reader-priority-label" class="task-readonly-label">Priority</span>
        <div class="task-readonly-control" role="group" aria-labelledby="task-reader-priority-label">
          <TaskPriorityBadge
            priority={task.priority}
            label={priorityLabel(task.priority ?? 'normal')}
          />
        </div>
      </div>

      <div class="field">
        <span class="task-readonly-label">Tags</span>
        <p class="task-readonly-value">{tagsJoined}</p>
      </div>

      <div class="field">
        <span class="task-readonly-label">Owner</span>
        <p class="task-readonly-value">{task.owner ?? ''}</p>
      </div>

      <div class="field-group">
        <div class="field">
          <span class="task-readonly-label">Due</span>
          <p class="task-readonly-value">{formatDate(task.dueAt)}</p>
        </div>
        <div class="field">
          <span class="task-readonly-label">Created</span>
          <p class="task-readonly-value">{formatDate(task.createdAt)}</p>
        </div>
      </div>

      <div class="form-actions">
        <TaskCardActions
          onEdit={onEdit}
          onDelete={onDelete}
          deleteTitle={`Delete task ${task.title}`}
        />
      </div>
    </div>
  </div>
</div>
