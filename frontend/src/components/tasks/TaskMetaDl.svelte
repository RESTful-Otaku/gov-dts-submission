<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'

  export let rows: readonly { term: string; description: string }[] = []
  export let dueDescription: string | null = null
  export let createdDescription: string | null = null

  $: resolvedRows =
    rows && rows.length > 0
      ? rows
      : [
          ...(dueDescription !== null
            ? [{ term: UI_COPY.tasks.views.dueTerm, description: dueDescription }]
            : []),
          ...(createdDescription !== null
            ? [{ term: UI_COPY.tasks.views.createdTerm, description: createdDescription }]
            : []),
        ]
</script>

<dl class="meta">
  {#each resolvedRows as row}
    <div>
      <dt>{row.term}</dt>
      <dd>{row.description}</dd>
    </div>
  {/each}
</dl>
