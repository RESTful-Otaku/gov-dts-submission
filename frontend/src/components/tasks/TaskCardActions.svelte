<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
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
      title={UI_COPY.common.editTask}
      aria-label={UI_COPY.common.edit}
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
      <span class="btn-icon-compact__label">{UI_COPY.common.edit}</span>
    </button>
    <button
      type="button"
      class="danger btn-icon-compact"
      data-tour={tourSpotlight === 'delete' ? 'tour-spot-delete' : undefined}
      on:click|stopPropagation={() => onDelete()}
      title={deleteTitle}
      aria-label={UI_COPY.common.delete}
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
      <span class="btn-icon-compact__label">{UI_COPY.common.delete}</span>
    </button>
  {:else}
    <button
      type="button"
      class="btn-icon-compact"
      data-tour={tourSpotlight === 'edit' ? 'tour-spot-edit' : undefined}
      on:click={onEdit}
      title={UI_COPY.common.editTask}
      aria-label={UI_COPY.common.edit}
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
      <span class="btn-icon-compact__label">{UI_COPY.common.edit}</span>
    </button>
    <button
      type="button"
      class="danger btn-icon-compact"
      data-tour={tourSpotlight === 'delete' ? 'tour-spot-delete' : undefined}
      on:click={onDelete}
      title={deleteTitle}
      aria-label={UI_COPY.common.delete}
    >
      <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
      <span class="btn-icon-compact__label">{UI_COPY.common.delete}</span>
    </button>
  {/if}
</div>
