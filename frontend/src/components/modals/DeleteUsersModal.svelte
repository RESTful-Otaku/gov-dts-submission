<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { AuthUser } from '../../lib/api'
  import ModalHeader from './ModalHeader.svelte'

  export let users: AuthUser[]
  export let deleteUserModalIds: string[]

  export let handleModalBackdropClick: (event: MouseEvent) => void
  export let closeDeleteUsersModal: () => void
  export let performDeleteUsers: () => void | Promise<void>

  $: victims = deleteUserModalIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is AuthUser => Boolean(u))
  $: missingCount = Math.max(0, deleteUserModalIds.length - victims.length)
  $: title =
    deleteUserModalIds.length === 1
      ? 'Delete user?'
      : `Delete ${deleteUserModalIds.length} users?`
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-users-modal-title"
  tabindex="-1"
  on:click={handleModalBackdropClick}
  on:keydown={(e) => e.key === 'Escape' && closeDeleteUsersModal()}
  transition:fade={{ duration: 200 }}
>
  <div
    class="modal modal--delete"
    role="document"
    on:keydown={(e) => e.key === 'Escape' && closeDeleteUsersModal()}
    transition:fade={{ duration: 200 }}
  >
    <ModalHeader titleId="delete-users-modal-title" title={title} onClose={closeDeleteUsersModal} />
    <div class="modal-body">
      {#if deleteUserModalIds.length === 1 && victims.length === 1}
        <p>This will remove <strong>{victims[0].username}</strong> ({victims[0].email}) from the system.</p>
      {:else if deleteUserModalIds.length === 1}
        <p>This will remove the selected account from the system.</p>
      {:else if deleteUserModalIds.length > 1}
        <p>The following accounts will be removed:</p>
        <ul class="modal-task-list">
          {#each victims as u}
            <li>{u.username} ({u.email})</li>
          {/each}
        </ul>
        {#if missingCount > 0}
          <p class="muted">Plus {missingCount} other account(s) not shown on this page.</p>
        {/if}
      {:else}
        <p>No matching users in the current list.</p>
      {/if}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-icon-compact" on:click={closeDeleteUsersModal} aria-label="Cancel">
        <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
        <span class="btn-icon-compact__label">Cancel</span>
      </button>
      <button
        type="button"
        class="danger btn-icon-compact"
        disabled={deleteUserModalIds.length === 0}
        on:click={() => {
          void performDeleteUsers()
        }}
        aria-label="Confirm delete users"
      >
        <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
        <span class="btn-icon-compact__label">Delete</span>
      </button>
    </div>
  </div>
</div>
