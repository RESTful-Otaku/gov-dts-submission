<script lang="ts" context="module">
  export type { ViewMode } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { ViewMode } from '../../lib/app/types'

  export let viewMode: ViewMode
  export let onSetViewMode: (next: ViewMode) => void
</script>

<div class="view-toggle" data-tour="view-mode" aria-label="View mode">
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={viewMode === 'cards'}
    on:click={() => onSetViewMode('cards')}
    title="Summary view"
    aria-label="Summary"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">▦</span>
    <span class="btn-icon-compact__label">Summary</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={viewMode === 'list'}
    on:click={() => onSetViewMode('list')}
    title="List view"
    aria-label="List"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">☰</span>
    <span class="btn-icon-compact__label">List</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={viewMode === 'kanban'}
    on:click={() => onSetViewMode('kanban')}
    title="Kanban view"
    aria-label="Kanban"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">▤</span>
    <span class="btn-icon-compact__label">Kanban</span>
  </button>
</div>
