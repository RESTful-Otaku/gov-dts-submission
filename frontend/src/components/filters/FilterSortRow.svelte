<script lang="ts" context="module">
  export type { SortKey } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { SortKey } from '../../lib/app/types'
  import { UI_COPY } from '../../lib/app/copy'

  export let sortKey: SortKey
  export let sortAscending: boolean
</script>

<div class="sort-controls" data-tour="filter-sort">
  <span class="control-label">{UI_COPY.tasks.sort.label}</span>
  <select bind:value={sortKey} aria-label={UI_COPY.tasks.sort.aria}>
    <option value="due">{UI_COPY.tasks.sort.byDueDateTime}</option>
    <option value="title">{UI_COPY.tasks.sort.byTitle}</option>
    <option value="priority">{UI_COPY.tasks.sort.byPriority}</option>
    <option value="owner">{UI_COPY.tasks.sort.byOwner}</option>
    <option value="status">{UI_COPY.tasks.sort.byStatus}</option>
    <option value="tags">{UI_COPY.tasks.sort.byTags}</option>
    <option value="created">{UI_COPY.tasks.sort.byCreated}</option>
  </select>
  <button
    type="button"
    class="sort-direction"
    on:click={() => (sortAscending = !sortAscending)}
    aria-label={sortAscending ? UI_COPY.tasks.sort.ascAria : UI_COPY.tasks.sort.descAria}
  >
    {sortAscending ? UI_COPY.tasks.sort.ascShort : UI_COPY.tasks.sort.descShort}
  </button>
</div>
