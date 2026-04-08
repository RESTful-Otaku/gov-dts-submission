<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  export let hasActiveFilters: boolean
  export let clearAllFilters: () => void
</script>

{#if hasActiveFilters}
  <button
    type="button"
    class="btn-clear-filters btn-icon-compact"
    on:click={clearAllFilters}
    aria-label={UI_COPY.tasks.clearFiltersAria}
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
    <span class="btn-icon-compact__label">{UI_COPY.tasks.clearFilters}</span>
  </button>
{/if}
