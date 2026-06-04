<script lang="ts">
  import type { TaskStatus } from '../../lib/api'

  export let status: TaskStatus
  export let label: string
</script>

<span class={`status status-${status}`}>
  {label}
</span>

