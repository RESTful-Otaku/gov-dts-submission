<script lang="ts">
  export let hasActiveFilters: boolean
  export let clearAllFilters: () => void
</script>

{#if hasActiveFilters}
  <button
    type="button"
    class="btn-clear-filters btn-icon-compact"
    on:click={clearAllFilters}
    aria-label="Clear all filters"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
    <span class="btn-icon-compact__label">Clear filters</span>
  </button>
{/if}
