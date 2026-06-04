<script lang="ts">
  import TagChips from '../../src/components/tasks/TagChips.svelte'

  export let tags: string[] = []
  export let stopPropagation = false
  export let onTagClick: (tag: string) => void
  export let onOuterClick: () => void
</script>

<button type="button" on:click={onOuterClick} aria-label="outer">
  <TagChips wrapper="div" {tags} {stopPropagation} {onTagClick} />
</button>

