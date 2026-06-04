<script lang="ts">
  import type { TaskStatus } from '../../lib/api'
  import { STATUS_OPTIONS as STATUS_OPTIONS_META } from '../../lib/tasks/taskMeta'

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [...STATUS_OPTIONS_META]

  export let id: string
  export let value: TaskStatus
</script>

<select {id} bind:value>
  {#each STATUS_OPTIONS as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
