<script lang="ts">
  import { fade } from 'svelte/transition'
  import ModalHeader from './ModalHeader.svelte'

  export let isNarrow: boolean
  export let modalContentTransition: (node: HTMLElement, params: { isNarrow?: boolean }) => any

  export let firstName: string
  export let lastName: string
  export let displayName: string
  export let editUserModalFirstInput: HTMLInputElement | null

  export let closeEditUserModal: () => void
  export let saveEditUserProfile: () => void | Promise<void>
  export let handleModalBackdropClick: (event: MouseEvent) => void
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop"
  class:modal-backdrop--drawer={isNarrow}
  role="dialog"
  aria-modal="true"
  aria-labelledby="edit-user-modal-title"
  tabindex="-1"
  on:click={handleModalBackdropClick}
  on:keydown={(e) => e.key === 'Escape' && closeEditUserModal()}
  transition:fade={{ duration: 200 }}
>
  <div
    class="modal"
    class:modal--drawer={isNarrow}
    class:modal--task-form={!isNarrow}
    role="document"
    on:keydown={(e) => e.key === 'Escape' && closeEditUserModal()}
    transition:modalContentTransition={{ isNarrow }}
  >
    <ModalHeader titleId="edit-user-modal-title" title="Edit user" onClose={closeEditUserModal} />

    <form
      class="task-form"
      on:submit|preventDefault={() => {
        void saveEditUserProfile()
      }}
    >
      <div class="field">
        <label for="edit-user-first">First name<span class="required">*</span></label>
        <input
          bind:this={editUserModalFirstInput}
          id="edit-user-first"
          type="text"
          bind:value={firstName}
          placeholder="First name"
          required
        />
      </div>
      <div class="field">
        <label for="edit-user-last">Last name<span class="required">*</span></label>
        <input id="edit-user-last" type="text" bind:value={lastName} placeholder="Last name" required />
      </div>
      <div class="field">
        <label for="edit-user-display">Display name<span class="required">*</span></label>
        <input id="edit-user-display" type="text" bind:value={displayName} placeholder="Display name" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-icon-compact secondary" on:click={closeEditUserModal}>
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">Cancel</span>
        </button>
        <button type="submit" class="btn-icon-compact">
          <span class="btn-icon-compact__icon" aria-hidden="true">✓</span>
          <span class="btn-icon-compact__label">Save</span>
        </button>
      </div>
    </form>
  </div>
</div>
