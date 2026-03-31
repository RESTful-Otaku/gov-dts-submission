<script lang="ts">
  export let rows: readonly { term: string; description: string }[]
</script>

<dl class="meta">
  {#each rows as row}
    <div>
      <dt>{row.term}</dt>
      <dd>{row.description}</dd>
    </div>
  {/each}
</dl>
