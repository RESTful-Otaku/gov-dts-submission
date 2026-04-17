<script lang="ts">
  import { fade } from 'svelte/transition'
  import { UI_COPY } from '../../lib/app/copy'
  import type { Task } from '../../lib/api'

  import ModalHeader from './ModalHeader.svelte'

  export let tasks: Task[]
  export let deleteModalTaskIds: string[]

  export let handleModalBackdropClick: (event: MouseEvent) => void
  export let closeDeleteModal: () => void
  export let performDeleteTask: () => void | Promise<void>

  let tasksToDelete: Task[] = []

  $: tasksToDelete = tasks.filter((t) => deleteModalTaskIds.includes(t.id))
  $: deleteModalTitle =
    tasksToDelete.length === 1
      ? UI_COPY.modals.delete.titleSingle
      : `${UI_COPY.modals.delete.titleManyPrefix}${tasksToDelete.length}${UI_COPY.modals.delete.titleManySuffix}`
</script>

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
    <ModalHeader titleId="delete-modal-title" title={deleteModalTitle} onClose={closeDeleteModal} />
    <div class="modal-body">
      {#if tasksToDelete.length === 1}
        {@const one = tasksToDelete[0]}
        <p>
          {one.status !== 'done'
            ? UI_COPY.modals.delete.bodySinglePending
            : UI_COPY.modals.delete.bodySingleDone}
        </p>
        <p class="modal-task-title"><strong>{one.title}</strong></p>
      {:else if tasksToDelete.length > 1}
        <p>{UI_COPY.modals.delete.bodyMany}</p>
        <ul class="modal-task-list">
          {#each tasksToDelete as t}
            <li>{t.title}</li>
          {/each}
        </ul>
      {:else}
        <p>{UI_COPY.modals.delete.bodyEmpty}</p>
      {/if}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-icon-compact" on:click={closeDeleteModal} aria-label={UI_COPY.modals.delete.cancelDeleteAria}>
        <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
        <span class="btn-icon-compact__label">{UI_COPY.modals.cancel}</span>
      </button>
      <button
        type="button"
        class="danger btn-icon-compact"
        on:click={performDeleteTask}
        disabled={tasksToDelete.length === 0}
        aria-label={tasksToDelete.length === 1 ? UI_COPY.modals.delete.deleteTask : UI_COPY.modals.delete.deleteTasks}
      >
        <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
        <span class="btn-icon-compact__label">{tasksToDelete.length === 1 ? UI_COPY.modals.delete.deleteTask : UI_COPY.modals.delete.deleteTasks}</span>
      </button>
    </div>
  </div>
</div>

