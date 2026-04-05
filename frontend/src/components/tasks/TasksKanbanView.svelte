<script lang="ts">
  import { flip } from 'svelte/animate'
  import { dndzone } from 'svelte-dnd-action'
  import { modalContentTransition } from '../../lib/ui/modalContentTransition'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import TagChips from './TagChips.svelte'
  import TaskCardActions from './TaskCardActions.svelte'
  import TaskCardReaderOverlay from './TaskCardReaderOverlay.svelte'
  import TaskMetaDl from './TaskMetaDl.svelte'
  import TaskPriorityBadge from './TaskPriorityBadge.svelte'
  import TaskStatusBadge from './TaskStatusBadge.svelte'

  export let visibleTasks: Task[]
  export let KANBAN_COLUMNS: { status: TaskStatus; title: string }[]
  export let KANBAN_FLIP_MS: number

  export let tasksForColumn: (status: TaskStatus) => Task[]

  export let handleKanbanConsider: (status: TaskStatus, e: CustomEvent<{ items: Task[] }>) => void
  export let handleKanbanFinalize: (status: TaskStatus, e: CustomEvent<{ items: Task[] }>) => void

  export let filterByTag: (tag: string) => void
  export let openEditModal: (task: Task) => void
  export let handleDeleteTask: (taskId: string) => void
  export let onOpenReader: (() => void) | undefined = undefined

  export let statusLabel: (s: TaskStatus) => string
  export let priorityLabel: (p: TaskPriority) => string
  export let formatDate: (value: string) => string
  export let isNarrow: boolean

  let readerTaskId: string | null = null
  $: readerTask = readerTaskId === null ? null : visibleTasks.find((t) => t.id === readerTaskId) ?? null

  function openReader(taskId: string): void {
    readerTaskId = taskId
    onOpenReader?.()
  }
</script>

<div class="kanban" role="region" aria-label="Tasks in kanban view" data-tour="pick-task">
  {#each KANBAN_COLUMNS as column}
    <section
      class="kanban-column"
      role="list"
      aria-label={column.title}
    >
      <header class="kanban-column-header">
        <h3>{column.title}</h3>
        <span class="badge">
          {visibleTasks.filter((t) => t.status === column.status).length}
        </span>
      </header>
      <div
        class="kanban-column-body"
        use:dndzone={{
          items: tasksForColumn(column.status),
          flipDurationMs: KANBAN_FLIP_MS,
          type: 'kanban',
        }}
        on:consider={(e) => handleKanbanConsider(column.status, e)}
        on:finalize={(e) => handleKanbanFinalize(column.status, e)}
        aria-label={column.title}
      >
        {#each tasksForColumn(column.status) as task (task.id)}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <article
            class="task kanban-task"
            role="listitem"
            aria-label={task.title}
            animate:flip={{ duration: KANBAN_FLIP_MS }}
            on:click={() => openReader(task.id)}
          >
            <h4>{task.title}</h4>
            <div class="kanban-card-badges">
              <TaskStatusBadge status={task.status} label={statusLabel(task.status)} />
              <TaskPriorityBadge
                priority={task.priority}
                label={priorityLabel(task.priority ?? 'normal')}
              />
            </div>
            {#if task.owner}
              <p class="task-owner">{task.owner}</p>
            {/if}
            {#if task.description}
              <p class="task-description">{task.description}</p>
            {/if}
            <TagChips
              tags={task.tags ?? []}
              onTagClick={filterByTag}
              stopPropagation={true}
            />
            <TaskMetaDl rows={[{ term: 'Due', description: formatDate(task.dueAt) }]} />
            <TaskCardActions
              stopPropagation={true}
              onEdit={() => openEditModal(task)}
              onDelete={() => handleDeleteTask(task.id)}
              deleteTitle={`Delete task ${task.title}`}
            />
          </article>
        {:else}
          <p class="kanban-empty">Drop tasks here or add via Create task.</p>
        {/each}
      </div>
    </section>
  {/each}
</div>

{#if readerTask}
  <TaskCardReaderOverlay
    isNarrow={isNarrow}
    modalContentTransition={modalContentTransition}
    task={readerTask}
    onClose={() => (readerTaskId = null)}
    onEdit={() => openEditModal(readerTask)}
    onDelete={() => handleDeleteTask(readerTask.id)}
    priorityLabel={priorityLabel}
    statusLabel={statusLabel}
    formatDate={formatDate}
  />
{/if}

