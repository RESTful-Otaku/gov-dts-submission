<script lang="ts">
  export let listPage: number
  export let listPageSize: number
  export let totalListPages: number
  export let visibleCount: number
  export let LIST_PAGE_SIZES: readonly number[]
</script>

<nav class="list-pagination" aria-label="List pagination">
  <div class="list-pagination-info">
    Showing {(listPage - 1) * listPageSize + 1}–{Math.min(listPage * listPageSize, visibleCount)} of {visibleCount}
  </div>
  <div class="list-pagination-controls">
    <button
      type="button"
      class="pagination-btn"
      disabled={listPage <= 1}
      aria-label="Previous page"
      on:click={() => (listPage = Math.max(1, listPage - 1))}
    >
      Previous
    </button>
    <span class="pagination-page" aria-current="page">
      Page {listPage} of {totalListPages}
    </span>
    <button
      type="button"
      class="pagination-btn"
      disabled={listPage >= totalListPages}
      aria-label="Next page"
      on:click={() => (listPage = Math.min(totalListPages, listPage + 1))}
    >
      Next
    </button>
  </div>
  <div class="list-pagination-size">
    <label for="list-page-size">
      <span class="control-label">Per page</span>
    </label>
    <select
      id="list-page-size"
      value={listPageSize}
      aria-label="Tasks per page"
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
