<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { TaskPriority, TaskStatus } from '../../lib/api'
  import TaskPrioritySelect from '../forms/TaskPrioritySelect.svelte'
  import TaskStatusSelect from '../forms/TaskStatusSelect.svelte'
  import ModalHeader from './ModalHeader.svelte'

  export let isNarrow: boolean
  // Provided by the app shell (`lib/ui/modalContentTransition`) so behavior stays consistent.
  export let modalContentTransition: (node: HTMLElement, params: { isNarrow?: boolean }) => any

  export let editTitle: string
  export let editDescription: string
  export let editStatus: TaskStatus
  export let editPriority: TaskPriority
  export let editTagsInput: string
  export let editModalFirstInput: HTMLInputElement | null

  export let closeEditModal: () => void
  export let handleEditTask: (event: SubmitEvent) => void
  export let handleModalBackdropClick: (event: MouseEvent) => void
</script>

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
    <ModalHeader titleId="edit-modal-title" title="Edit task" onClose={closeEditModal} />

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
        <TaskStatusSelect id="edit-status" bind:value={editStatus} />
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
        <TaskPrioritySelect id="edit-priority" bind:value={editPriority} />
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
        <button type="button" class="btn-icon-compact" on:click={closeEditModal} aria-label="Cancel">
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">Cancel</span>
        </button>
        <button type="submit" class="btn-icon-compact" aria-label="Save changes">
          <span class="btn-icon-compact__icon" aria-hidden="true">💾</span>
          <span class="btn-icon-compact__label">Save changes</span>
        </button>
      </div>
    </form>
  </div>
</div>

