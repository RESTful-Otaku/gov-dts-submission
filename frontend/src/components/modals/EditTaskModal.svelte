<script lang="ts">
  import { fade } from 'svelte/transition'
  import { UI_COPY } from '../../lib/app/copy'
  import type { TaskPriority, TaskStatus } from '../../lib/api'
  import TaskPrioritySelect from '../forms/TaskPrioritySelect.svelte'
  import TaskStatusSelect from '../forms/TaskStatusSelect.svelte'
  import ModalHeader from './ModalHeader.svelte'
  import FieldValidityIcon from '../forms/FieldValidityIcon.svelte'

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

  export let titleFieldBlurred = false
  export let titleFieldValid = false
  export let onTitleFieldBlur: () => void = () => {}
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
    class:modal--task-form={!isNarrow}
    role="document"
    on:keydown={(e) => e.key === 'Escape' && closeEditModal()}
    transition:modalContentTransition={{ isNarrow }}
  >
    <ModalHeader titleId="edit-modal-title" title={UI_COPY.modals.edit.title} onClose={closeEditModal} />

    <form class="task-form" on:submit|preventDefault={handleEditTask}>
      <div class="field">
        <div class="task-field-label-row">
          <label for="edit-title-input">Title<span class="required">*</span></label>
          <FieldValidityIcon blurred={titleFieldBlurred} valid={titleFieldValid} />
        </div>
        <input
          bind:this={editModalFirstInput}
          id="edit-title-input"
          type="text"
          bind:value={editTitle}
          placeholder={UI_COPY.modals.edit.taskTitlePlaceholder}
          required
          on:blur={onTitleFieldBlur}
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
          placeholder={UI_COPY.modals.edit.descriptionPlaceholder}
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
          placeholder={UI_COPY.modals.edit.tagsPlaceholder}
        />
      </div>

      <div class="form-actions">
        <button type="button" class="btn-icon-compact" on:click={closeEditModal} aria-label={UI_COPY.modals.cancel}>
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">{UI_COPY.modals.cancel}</span>
        </button>
        <button type="submit" class="btn-icon-compact" aria-label={UI_COPY.modals.edit.saveCta}>
          <span class="btn-icon-compact__icon" aria-hidden="true">💾</span>
          <span class="btn-icon-compact__label">{UI_COPY.modals.edit.saveCta}</span>
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .task-field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    margin-bottom: 0.2rem;
  }

  .task-field-label-row label {
    margin: 0;
  }
</style>

