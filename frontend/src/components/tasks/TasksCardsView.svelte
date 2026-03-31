<script lang="ts">
  import { modalContentTransition } from '../../lib/ui/modalContentTransition'
  import type { Task, TaskPriority, TaskStatus } from '../../lib/api'
  import SwipeableTaskMobile from './SwipeableTaskMobile.svelte'
  import TagChips from './TagChips.svelte'
  import TaskCardActions from './TaskCardActions.svelte'
  import TaskCardReaderOverlay from './TaskCardReaderOverlay.svelte'
  import TaskMetaDl from './TaskMetaDl.svelte'
  import TaskPriorityBadge from './TaskPriorityBadge.svelte'
  import TaskStatusBadge from './TaskStatusBadge.svelte'

  export let visibleTasks: Task[]
  export let isNarrow: boolean

  export let priorityLabel: (p: TaskPriority) => string
  export let statusLabel: (s: TaskStatus) => string
  export let formatDate: (value: string) => string

  export let openEditModal: (task: Task) => void
  export let handleDeleteTask: (taskId: string) => void
  export let filterByTag: (tag: string) => void
  export let onOpenReader: (() => void) | undefined = undefined
  /** Optional: e.g. onboarding when user completes a swipe gesture on mobile. */
  export let onSwipeGesture: (() => void) | undefined = undefined

  let readerTaskId: string | null = null
  $: readerTask = readerTaskId === null ? null : visibleTasks.find((t) => t.id === readerTaskId) ?? null

  function openReader(taskId: string): void {
    readerTaskId = taskId
    onOpenReader?.()
  }
</script>

<div
  class="tasks-grid"
  role="region"
  aria-label="Tasks in summary cards view"
  data-tour={isNarrow ? 'card-swipe' : undefined}
>
  {#if visibleTasks.length === 0}
    <p class="empty">No tasks match your current search or filters.</p>
  {:else}
    {#each visibleTasks as taskItem}
      <SwipeableTaskMobile
        enabled={isNarrow}
        onEdit={() => openEditModal(taskItem)}
        onDelete={() => handleDeleteTask(taskItem.id)}
        onSwipeCommitted={onSwipeGesture}
        onOpen={() => openReader(taskItem.id)}
      >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <article class="task" on:click={() => !isNarrow && openReader(taskItem.id)}>
          <header class="task-header">
            <h3>{taskItem.title}</h3>
            <div class="task-badges">
              <TaskPriorityBadge
                priority={taskItem.priority}
                label={priorityLabel(taskItem.priority ?? 'normal')}
              />
              <TaskStatusBadge
                status={taskItem.status}
                label={statusLabel(taskItem.status)}
              />
            </div>
          </header>
          {#if taskItem.owner}
            <p class="task-owner">Owner: {taskItem.owner}</p>
          {/if}
          {#if taskItem.description}
            <p class="task-description">
              {taskItem.description}
            </p>
          {/if}
          <TagChips tags={taskItem.tags ?? []} onTagClick={filterByTag} stopPropagation={!isNarrow} />

          <TaskMetaDl
            rows={[
              { term: 'Due', description: formatDate(taskItem.dueAt) },
              { term: 'Created', description: formatDate(taskItem.createdAt) },
            ]}
          />

          <TaskCardActions
            stopPropagation={!isNarrow}
            onEdit={() => openEditModal(taskItem)}
            onDelete={() => handleDeleteTask(taskItem.id)}
            deleteTitle={`Delete task ${taskItem.title}`}
          />
        </article>
      </SwipeableTaskMobile>
    {/each}
  {/if}
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
