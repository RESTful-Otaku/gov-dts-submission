<script lang="ts">
  import type { TaskPriority } from '../../lib/api'
  import { PRIORITY_OPTIONS as PRIORITY_OPTIONS_META } from '../../lib/tasks/taskMeta'

  const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [...PRIORITY_OPTIONS_META]

  export let id: string
  export let value: TaskPriority
</script>

<select {id} bind:value>
  {#each PRIORITY_OPTIONS as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
