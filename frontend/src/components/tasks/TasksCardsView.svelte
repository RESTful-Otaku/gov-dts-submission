<script lang="ts">
  import { onMount } from 'svelte'
  import { UI_COPY } from '../../lib/app/copy'
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
  export let canMutateTasks = true

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

  const INITIAL_BATCH = 18
  const LOAD_BATCH = 12
  const LAZY_REVEAL_DELAY_MS = 220

  let readerTaskId: string | null = null
  let renderLimit = INITIAL_BATCH
  let loadSentinel: HTMLDivElement | null = null
  let observer: IntersectionObserver | null = null
  let observedSentinel: HTMLDivElement | null = null
  let visibleSignature = ''
  let hasUserScrolled = false
  let pendingLoad = false
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  $: visibleTaskById = new Map(visibleTasks.map((t) => [t.id, t]))
  $: readerTask = readerTaskId === null ? null : visibleTaskById.get(readerTaskId) ?? null
  $: nextSignature = `${visibleTasks.length}:${visibleTasks[0]?.id ?? ''}:${visibleTasks[visibleTasks.length - 1]?.id ?? ''}`
  $: if (nextSignature !== visibleSignature) {
    visibleSignature = nextSignature
    renderLimit = Math.min(visibleTasks.length, INITIAL_BATCH)
    hasUserScrolled = false
    pendingLoad = false
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
  }
  $: renderedTasks = visibleTasks.slice(0, renderLimit)
  $: remainingCount = Math.max(0, visibleTasks.length - renderLimit)
  $: placeholderCount = Math.min(LOAD_BATCH, remainingCount)

  function openReader(taskId: string): void {
    readerTaskId = taskId
    onOpenReader?.()
  }

  function loadMore(): void {
    if (renderLimit >= visibleTasks.length || pendingLoad) return
    pendingLoad = true
    pendingTimer = setTimeout(() => {
      renderLimit = Math.min(visibleTasks.length, renderLimit + LOAD_BATCH)
      pendingLoad = false
      pendingTimer = null
    }, LAZY_REVEAL_DELAY_MS)
  }

  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') {
      // Test/legacy environments without IO support: render all cards.
      renderLimit = visibleTasks.length
      return
    }
    const onScroll = () => {
      hasUserScrolled = true
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (!hasUserScrolled) return
        loadMore()
      },
      { rootMargin: '120px 0px' },
    )
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        pendingTimer = null
      }
      observer?.disconnect()
      observer = null
      observedSentinel = null
    }
  })

  $: {
    if (!observer) {
      // onMount has not run yet
    } else if (loadSentinel && loadSentinel !== observedSentinel) {
      if (observedSentinel) observer.unobserve(observedSentinel)
      observer.observe(loadSentinel)
      observedSentinel = loadSentinel
    } else if (!loadSentinel && observedSentinel) {
      observer.unobserve(observedSentinel)
      observedSentinel = null
    }
  }
</script>

<div
  class="tasks-grid"
  role="region"
  aria-label={UI_COPY.tasks.views.cardsRegionAria}
  data-tour="pick-task"
>
  {#if visibleTasks.length === 0}
    <p class="empty">{UI_COPY.tasks.views.emptyState}</p>
  {:else}
    {#each renderedTasks as taskItem}
      {@const anchor = tourAnchorTaskId !== null && taskItem.id === tourAnchorTaskId}
      {@const cardTourSpotlight =
        anchor && tourSpotlightStepId === 'edit_task'
          ? ('edit' as const)
          : anchor && tourSpotlightStepId === 'delete_task'
            ? ('delete' as const)
            : null}
      <SwipeableTaskMobile
        enabled={isNarrow && canMutateTasks}
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
          on:click={() => {
            if (!isNarrow) openReader(taskItem.id)
            else if (!canMutateTasks) openReader(taskItem.id)
          }}
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
            <p class="task-owner">{UI_COPY.tasks.views.ownerPrefix} {taskItem.owner}</p>
          {/if}
          {#if taskItem.description}
            <p class="task-description">
              {taskItem.description}
            </p>
          {/if}
          <TagChips tags={taskItem.tags ?? []} onTagClick={filterByTag} stopPropagation={!isNarrow} />

          <TaskMetaDl
            dueDescription={formatDate(taskItem.dueAt)}
            createdDescription={formatDate(taskItem.createdAt)}
          />

          {#if canMutateTasks}
            <TaskCardActions
              stopPropagation={!isNarrow}
              tourSpotlight={cardTourSpotlight}
              onEdit={() => openEditModal(taskItem)}
              onDelete={() => handleDeleteTask(taskItem.id)}
              deleteTitle={`${UI_COPY.common.deleteTask} ${taskItem.title}`}
            />
          {/if}
        </article>
      </SwipeableTaskMobile>
    {/each}
    {#if placeholderCount > 0}
      {#each Array(placeholderCount) as _, idx (idx)}
        <article class="task task--skeleton" aria-hidden="true">
          <div class="task-skeleton-line task-skeleton-line--title"></div>
          <div class="task-skeleton-line"></div>
          <div class="task-skeleton-line task-skeleton-line--short"></div>
          <div class="task-skeleton-line task-skeleton-line--meta"></div>
        </article>
      {/each}
      <div class="cards-load-sentinel" bind:this={loadSentinel}>
        <span>{UI_COPY.tasks.views.loadingMoreCards}</span>
      </div>
    {/if}
  {/if}
</div>

{#if readerTask}
  <TaskCardReaderOverlay
    isNarrow={isNarrow}
    modalContentTransition={modalContentTransition}
    task={readerTask}
    showActions={canMutateTasks}
    onClose={() => (readerTaskId = null)}
    onEdit={() => openEditModal(readerTask)}
    onDelete={() => handleDeleteTask(readerTask.id)}
    priorityLabel={priorityLabel}
    statusLabel={statusLabel}
    formatDate={formatDate}
  />
{/if}
