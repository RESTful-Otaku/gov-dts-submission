<script lang="ts">
  export let overdueCount: number
  export let dueTodayCount: number
  export let dueThisWeekCount: number
</script>

<div class="metrics-strip" role="status" aria-label="Task due date summary">
  <span class="metric metric--overdue">
    <strong>{overdueCount}</strong> overdue
  </span>
  <span class="metric metric--due-today">
    <strong>{dueTodayCount}</strong> due today
  </span>
  <span class="metric metric--due-soon">
    <strong>{dueThisWeekCount}</strong> due this week
  </span>
</div>
