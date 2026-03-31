<script lang="ts">
  export let tags: string[] = []
  export let onTagClick: (tag: string) => void
  export let stopPropagation = false
  export let wrapper: 'div' | 'span' = 'div'
</script>

{#if tags.length > 0}
  <svelte:element this={wrapper} class="tag-chips">
    {#each tags as tag}
      {#if stopPropagation}
        <button
          type="button"
          class="tag-chip"
          on:click|stopPropagation={() => onTagClick(tag)}
          title="Filter by this tag"
        >
          {tag}
        </button>
      {:else}
        <button
          type="button"
          class="tag-chip"
          on:click={() => onTagClick(tag)}
          title="Filter by this tag"
        >
          {tag}
        </button>
      {/if}
    {/each}
  </svelte:element>
{/if}

