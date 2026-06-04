<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  export let listPage: number
  export let listPageSize: number
  export let totalListPages: number
  export let visibleCount: number
  export let LIST_PAGE_SIZES: readonly number[]
</script>

<nav class="list-pagination" aria-label={UI_COPY.tasks.views.listPaginationAria}>
  <div class="list-pagination-info">
    {UI_COPY.tasks.views.showingPrefix} {(listPage - 1) * listPageSize + 1}–{Math.min(listPage * listPageSize, visibleCount)} {UI_COPY.tasks.views.of} {visibleCount}
  </div>
  <div class="list-pagination-controls">
    <button
      type="button"
      class="pagination-btn"
      disabled={listPage <= 1}
      aria-label={UI_COPY.tasks.views.previousPageAria}
      on:click={() => (listPage = Math.max(1, listPage - 1))}
    >
      {UI_COPY.tasks.views.previous}
    </button>
    <span class="pagination-page" aria-current="page">
      {UI_COPY.tasks.views.pagePrefix} {listPage} {UI_COPY.tasks.views.of} {totalListPages}
    </span>
    <button
      type="button"
      class="pagination-btn"
      disabled={listPage >= totalListPages}
      aria-label={UI_COPY.tasks.views.nextPageAria}
      on:click={() => (listPage = Math.min(totalListPages, listPage + 1))}
    >
      {UI_COPY.tasks.views.next}
    </button>
  </div>
  <div class="list-pagination-size">
    <label for="list-page-size">
      <span class="control-label">{UI_COPY.tasks.views.perPage}</span>
    </label>
    <select
      id="list-page-size"
      value={listPageSize}
      aria-label={UI_COPY.tasks.views.tasksPerPageAria}
      on:change={(e) => {
        const v = Number((e.currentTarget as HTMLSelectElement).value)
        if (LIST_PAGE_SIZES.includes(v)) {
          listPageSize = v
          listPage = 1
        }
      }}
    >
      {#each LIST_PAGE_SIZES as size}
        <option value={size}>{size}</option>
      {/each}
    </select>
  </div>
</nav>
