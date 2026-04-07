<script lang="ts">
  /** When true, click handlers use `stopPropagation` (e.g. Kanban cards on a draggable surface). */
  export let stopPropagation = false
  export let onEdit: () => void
  export let onDelete: () => void
  export let deleteTitle: string
  /** Onboarding: spotlight one control (`tour-spot-edit` / `tour-spot-delete` query targets). */
  export let tourSpotlight: 'edit' | 'delete' | null = null
</script>

<div class="task-actions">
  {#if stopPropagation}
    <button
      type="button"
      class="btn-icon-compact"
      data-tour={tourSpotlight === 'edit' ? 'tour-spot-edit' : undefined}
      on:click|stopPropagation={() => onEdit()}
      title="Edit task"
      aria-label="Edit"
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
      <span class="btn-icon-compact__label">Edit</span>
    </button>
    <button
      type="button"
      class="danger btn-icon-compact"
      data-tour={tourSpotlight === 'delete' ? 'tour-spot-delete' : undefined}
      on:click|stopPropagation={() => onDelete()}
      title={deleteTitle}
      aria-label="Delete"
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
      <span class="btn-icon-compact__label">Delete</span>
    </button>
  {:else}
    <button
      type="button"
      class="btn-icon-compact"
      data-tour={tourSpotlight === 'edit' ? 'tour-spot-edit' : undefined}
      on:click={onEdit}
      title="Edit task"
      aria-label="Edit"
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
      <span class="btn-icon-compact__label">Edit</span>
    </button>
    <button
      type="button"
      class="danger btn-icon-compact"
      data-tour={tourSpotlight === 'delete' ? 'tour-spot-delete' : undefined}
      on:click={onDelete}
      title={deleteTitle}
      aria-label="Delete"
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
      <span class="btn-icon-compact__label">Delete</span>
    </button>
  {/if}
</div>
