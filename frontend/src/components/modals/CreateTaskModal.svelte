<script lang="ts">
  import { fade } from 'svelte/transition'
  import { UI_COPY } from '../../lib/app/copy'
  import SveltyPicker from 'svelty-picker'
  import type { TaskPriority, TaskStatus } from '../../lib/api'
  import TaskPrioritySelect from '../forms/TaskPrioritySelect.svelte'
  import TaskStatusSelect from '../forms/TaskStatusSelect.svelte'
  import ModalHeader from './ModalHeader.svelte'
  import FieldValidityIcon from '../forms/FieldValidityIcon.svelte'
  import type { i18nType } from 'svelty-picker/i18n'

  export let isNarrow: boolean
  // Provided by the app shell (`lib/ui/modalContentTransition`) so behavior stays consistent.
  export let modalContentTransition: (node: HTMLElement, params: { isNarrow?: boolean }) => any

  export let title: string
  export let description: string
  export let status: TaskStatus
  export let priority: TaskPriority
  export let owner: string
  /** Display names from `GET /api/users/display-names` for datalist suggestions. */
  export let ownerDisplayNames: string[] = []
  export let tagsInput: string
  export let dueDateTimeStr: string
  export let modalFirstInput: HTMLInputElement | null

  export let DATETIME_FORMAT: string
  export let PICKER_I18N: i18nType

  export let closeCreateModal: () => void
  export let handleCreateTask: (event: SubmitEvent) => void
  export let handleModalBackdropClick: (event: MouseEvent) => void

  export let titleFieldBlurred = false
  export let dueFieldBlurred = false
  export let titleFieldValid = false
  export let dueFieldValid = false
  export let onTitleFieldBlur: () => void = () => {}
  export let onDueFieldBlur: () => void = () => {}
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
    <ModalHeader titleId="modal-title" title={UI_COPY.modals.create.title} onClose={closeCreateModal} />

    <form class="task-form" on:submit|preventDefault={handleCreateTask}>
      <div class="field">
        <div class="task-field-label-row">
          <label for="modal-title-input">Title<span class="required">*</span></label>
          <FieldValidityIcon blurred={titleFieldBlurred} valid={titleFieldValid} />
        </div>
        <input
          bind:this={modalFirstInput}
          id="modal-title-input"
          type="text"
          bind:value={title}
          placeholder={UI_COPY.modals.create.taskTitlePlaceholder}
          required
          on:blur={onTitleFieldBlur}
        />
      </div>

      <div class="field">
        <label for="modal-description">Description</label>
        <textarea
          id="modal-description"
          rows="3"
          bind:value={description}
          placeholder={UI_COPY.modals.create.descriptionPlaceholder}
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
          list="create-task-owner-names"
          autocomplete="off"
          placeholder={UI_COPY.modals.create.ownerPlaceholder}
        />
        <datalist id="create-task-owner-names">
          {#each ownerDisplayNames as name (name)}
            <option value={name}></option>
          {/each}
        </datalist>
      </div>

      <div class="field">
        <label for="modal-tags">Tags (comma-separated)</label>
        <input
          id="modal-tags"
          type="text"
          bind:value={tagsInput}
          placeholder={UI_COPY.modals.create.tagsPlaceholder}
        />
      </div>

      <div class="field-group">
        <div class="field" on:focusout={onDueFieldBlur}>
          <div class="task-field-label-row">
            <label for="modal-due-datetime">{UI_COPY.modals.create.dueLabel}<span class="required">*</span></label>
            <FieldValidityIcon blurred={dueFieldBlurred} valid={dueFieldValid} />
          </div>
          <SveltyPicker
            inputId="modal-due-datetime"
            mode="datetime"
            format={DATETIME_FORMAT}
            formatType="standard"
            bind:value={dueDateTimeStr}
            placeholder={UI_COPY.modals.create.duePlaceholder}
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
        <button type="button" class="btn-icon-compact" on:click={closeCreateModal} aria-label={UI_COPY.modals.cancel}>
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">{UI_COPY.modals.cancel}</span>
        </button>
        <button type="submit" class="btn-icon-compact" aria-label={UI_COPY.modals.create.saveCta}>
          <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
          <span class="btn-icon-compact__label">{UI_COPY.modals.create.saveCta}</span>
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

