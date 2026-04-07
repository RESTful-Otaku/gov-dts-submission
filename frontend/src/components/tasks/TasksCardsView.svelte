<script lang="ts">
  import { modalContentTransition } from '../../lib/ui/modalContentTransition'
  import type { OnboardingStepId } from '../../lib/app/onboarding/types'
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
  export let tourSpotlightStepId: OnboardingStepId | null = null
  export let tourAnchorTaskId: string | null = null

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
  data-tour="pick-task"
>
  {#if visibleTasks.length === 0}
    <p class="empty">No tasks match your current search or filters.</p>
  {:else}
    {#each visibleTasks as taskItem}
      {@const anchor = tourAnchorTaskId !== null && taskItem.id === tourAnchorTaskId}
      {@const cardTourSpotlight =
        anchor && tourSpotlightStepId === 'edit_task'
          ? ('edit' as const)
          : anchor && tourSpotlightStepId === 'delete_task'
            ? ('delete' as const)
            : null}
      <SwipeableTaskMobile
        enabled={isNarrow}
        tourSwipeAnchor={anchor && tourSpotlightStepId === 'card_swipe'}
        onEdit={() => openEditModal(taskItem)}
        onDelete={() => handleDeleteTask(taskItem.id)}
        onSwipeCommitted={onSwipeGesture}
        onOpen={() => openReader(taskItem.id)}
      >
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <article
          class="task"
          data-tour={anchor && tourSpotlightStepId === 'open_task_reader' ? 'tour-spot-open' : undefined}
          on:click={() => !isNarrow && openReader(taskItem.id)}
        >
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
            tourSpotlight={cardTourSpotlight}
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
