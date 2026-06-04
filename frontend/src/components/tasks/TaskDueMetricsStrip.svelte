<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  export let overdueCount: number
  export let dueTodayCount: number
  export let dueThisWeekCount: number
  export let onFocusToday: () => void = () => {}
</script>

<div class="metrics-strip" role="status" aria-label={UI_COPY.tasks.views.metricsAria}>
  <span class="metric metric--overdue">
    <strong>{overdueCount}</strong> {UI_COPY.tasks.views.overdueSuffix}
  </span>
  <span class="metric metric--due-today">
    <strong>{dueTodayCount}</strong> {UI_COPY.tasks.views.dueTodaySuffix}
  </span>
  <span class="metric metric--due-soon">
    <strong>{dueThisWeekCount}</strong> {UI_COPY.tasks.views.dueThisWeekSuffix}
  </span>
  <button
    type="button"
    class="btn-icon-compact"
    aria-label={UI_COPY.tasks.views.focusTodayAria}
    title={UI_COPY.tasks.views.focusTodayAria}
    on:click={onFocusToday}
  >
    <span class="btn-icon-compact__label">{UI_COPY.tasks.views.focusToday}</span>
  </button>
</div>
