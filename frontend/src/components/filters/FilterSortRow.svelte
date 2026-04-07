<script lang="ts" context="module">
  export type { SortKey } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { SortKey } from '../../lib/app/types'

  export let sortKey: SortKey
  export let sortAscending: boolean
</script>

<div class="sort-controls" data-tour="filter-sort">
  <span class="control-label">Sort</span>
  <select bind:value={sortKey} aria-label="Sort tasks by">
    <option value="due">Due date and time</option>
    <option value="title">Title (A–Z)</option>
    <option value="priority">Priority</option>
  </select>
  <button
    type="button"
    class="sort-direction"
    on:click={() => (sortAscending = !sortAscending)}
    aria-label={sortAscending ? 'Sort ascending' : 'Sort descending'}
  >
    {sortAscending ? 'Asc' : 'Des'}
  </button>
</div>
