<script lang="ts" context="module">
  export type { ViewMode } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { ViewMode } from '../../lib/app/types'
  import { UI_COPY } from '../../lib/app/copy'

  export let viewMode: ViewMode
  export let tasksActive = true
  export let onSetViewMode: (next: ViewMode) => void
</script>

<div class="view-toggle" data-tour="view-mode" aria-label={UI_COPY.tasks.views.viewModeAria}>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={tasksActive && viewMode === 'cards'}
    on:click={() => onSetViewMode('cards')}
    title={UI_COPY.tasks.views.summaryView}
    aria-label={UI_COPY.tasks.views.summary}
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">▦</span>
    <span class="btn-icon-compact__label">{UI_COPY.tasks.views.summary}</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={tasksActive && viewMode === 'list'}
    on:click={() => onSetViewMode('list')}
    title={UI_COPY.tasks.views.listView}
    aria-label={UI_COPY.tasks.views.list}
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">☰</span>
    <span class="btn-icon-compact__label">{UI_COPY.tasks.views.list}</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={tasksActive && viewMode === 'kanban'}
    on:click={() => onSetViewMode('kanban')}
    title={UI_COPY.tasks.views.kanbanView}
    aria-label={UI_COPY.tasks.views.kanban}
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">▤</span>
    <span class="btn-icon-compact__label">{UI_COPY.tasks.views.kanban}</span>
  </button>
</div>
