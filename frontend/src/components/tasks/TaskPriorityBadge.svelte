<script lang="ts">
  import type { TaskPriority } from '../../lib/api'

  export let priority: TaskPriority | undefined = 'normal'
  export let label: string
</script>

<span class="priority-badge priority-{priority ?? 'normal'}">
  {label}
</span>

