<script lang="ts">
  import { fade } from 'svelte/transition'
  import SveltyPicker from 'svelty-picker'
  import type { TaskPriority, TaskStatus } from '../../lib/api'
  import TaskPrioritySelect from '../forms/TaskPrioritySelect.svelte'
  import TaskStatusSelect from '../forms/TaskStatusSelect.svelte'
  import ModalHeader from './ModalHeader.svelte'
  import type { i18nType } from 'svelty-picker/i18n'

  export let isNarrow: boolean
  // Provided by the app shell (`lib/ui/modalContentTransition`) so behavior stays consistent.
  export let modalContentTransition: (node: HTMLElement, params: { isNarrow?: boolean }) => any

  export let title: string
  export let description: string
  export let status: TaskStatus
  export let priority: TaskPriority
  export let owner: string
  export let tagsInput: string
  export let dueDateTimeStr: string
  export let modalFirstInput: HTMLInputElement | null

  export let DATETIME_FORMAT: string
  export let PICKER_I18N: i18nType

  export let closeCreateModal: () => void
  export let handleCreateTask: (event: SubmitEvent) => void
  export let handleModalBackdropClick: (event: MouseEvent) => void
</script>

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
    class:modal--task-form={!isNarrow}
    role="document"
    on:keydown={(e) => e.key === 'Escape' && closeCreateModal()}
    transition:modalContentTransition={{ isNarrow }}
  >
    <ModalHeader titleId="modal-title" title="Create a new task" onClose={closeCreateModal} />

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
        <TaskStatusSelect id="modal-status" bind:value={status} />
      </div>

      <div class="field">
        <label for="modal-priority">Priority</label>
        <TaskPrioritySelect id="modal-priority" bind:value={priority} />
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
        <button type="button" class="btn-icon-compact" on:click={closeCreateModal} aria-label="Cancel">
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">Cancel</span>
        </button>
        <button type="submit" class="btn-icon-compact" aria-label="Create task">
          <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
          <span class="btn-icon-compact__label">Create task</span>
        </button>
      </div>
    </form>
  </div>
</div>

