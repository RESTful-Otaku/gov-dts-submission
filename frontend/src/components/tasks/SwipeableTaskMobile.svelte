<script lang="ts">
  import { onMount } from 'svelte'

  /**
  * Swipe right past a threshold → edit (green); swipe left → delete (red).
  * Reveal width tracks the swipe amount; crossing the threshold runs the action immediately.
   */
  export let enabled: boolean
  export let onEdit: () => void
  export let onDelete: () => void
  /** Fired when a horizontal swipe commits to edit or delete (onboarding / analytics). */
  export let onSwipeCommitted: (() => void) | undefined = undefined
  /** Fired when the user taps the card (no horizontal swipe). */
  export let onOpen: (() => void) | undefined = undefined

  let host: HTMLDivElement
  let width = 320
  let prevMeasured = 0

  /**
   * Max travel distance for the card (and max reveal width for underlays).
   * We keep this at 50% so the snap feels consistent with existing behavior.
   */
  $: actionW = Math.max(72, width * 0.5)
  /**
   * Activation distance (commit threshold) for edit/delete actions: 30% width.
   * Minimum is kept above the icon size so the icon is fully visible at activation.
   */
  $: activationDist = Math.max(48, width * 0.3)

  function measureHost(): void {
    if (!host) return
    const w = host.clientWidth || 320
    if (w !== prevMeasured) {
      prevMeasured = w
      committedOffset = 0
      dragging = false
    }
    width = w
  }

  let committedOffset = 0
  let dragging = false
  let startClientX = 0
  let startClientY = 0
  let dragStartCommitted = 0
  let dragDelta = 0
  let lockHorizontal = false

  function clampOffset(v: number, aw: number): number {
    const extra = width * 0.12
    return Math.max(-aw - extra, Math.min(aw + extra, v))
  }

  $: visual = dragging
    ? clampOffset(dragStartCommitted + dragDelta, actionW)
    : committedOffset

  $: editReveal = Math.max(0, visual)
  $: deleteReveal = Math.max(0, -visual)
  $: showEditIcon = editReveal >= activationDist
  $: showDeleteIcon = deleteReveal >= activationDist

  function resolveSnap(rawEnd: number, prev: number, aw: number, thr: number): number {
    if (prev === 0) {
      if (rawEnd >= thr) return aw
      if (rawEnd <= -thr) return -aw
      return 0
    }
    if (prev > 0) {
      return rawEnd <= aw * 0.5 ? 0 : aw
    }
    if (prev < 0) {
      return rawEnd >= -aw * 0.5 ? 0 : -aw
    }
    return 0
  }

  function interactiveTarget(t: EventTarget | null): boolean {
    if (!t || !(t instanceof Element)) return false
    return !!t.closest(
      'button, a, input, textarea, select, [role="button"], .tag-chip, .task-actions',
    )
  }

  function onPointerDown(e: PointerEvent): void {
    if (!enabled || e.button !== 0) return
    if (interactiveTarget(e.target)) return
    measureHost()
    dragging = true
    lockHorizontal = false
    startClientX = e.clientX
    startClientY = e.clientY
    dragStartCommitted = committedOffset
    dragDelta = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return
    const dx = e.clientX - startClientX
    const dy = e.clientY - startClientY
    if (!lockHorizontal) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        lockHorizontal = true
      } else if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        dragging = false
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
        return
      }
    }
    if (lockHorizontal) {
      e.preventDefault()
      dragDelta = dx
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return
    const wasLock = lockHorizontal
    dragging = false
    lockHorizontal = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!wasLock) {
      dragDelta = 0
      const dx = e.clientX - startClientX
      const dy = e.clientY - startClientY
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        // Suppress the synthetic click that follows pointerup, which would otherwise hit
        // the newly mounted fullscreen reader backdrop and close it instantly.
        e.preventDefault()
        onOpen?.()
      }
      return
    }

    measureHost()
    const w = host?.clientWidth ?? width
    const aw = Math.max(72, w * 0.5)
    const thr = Math.max(48, w * 0.3)
    const rawEnd = dragStartCommitted + dragDelta
    dragDelta = 0
    const next = resolveSnap(rawEnd, dragStartCommitted, aw, thr)

    committedOffset = 0

    if (next > 0) {
      onSwipeCommitted?.()
      queueMicrotask(() => onEdit())
    } else if (next < 0) {
      onSwipeCommitted?.()
      queueMicrotask(() => onDelete())
    }
  }

  onMount(() => {
    measureHost()
    window.addEventListener('resize', measureHost)
    return () => window.removeEventListener('resize', measureHost)
  })
</script>

{#if !enabled}
  <slot />
{:else}
  <div class="swipe-task-host" bind:this={host}>
    <div
      class="swipe-task-under swipe-task-under--edit"
      aria-hidden="true"
      style="width: {Math.min(editReveal, actionW)}px"
    >
      <span class="swipe-task-icon-wrap" style="opacity: {showEditIcon ? 0.95 : 0}">
        <svg class="swipe-task-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
          />
        </svg>
      </span>
    </div>
    <div
      class="swipe-task-under swipe-task-under--delete"
      aria-hidden="true"
      style="width: {Math.min(deleteReveal, actionW)}px"
    >
      <span class="swipe-task-icon-wrap" style="opacity: {showDeleteIcon ? 0.95 : 0}">
        <svg class="swipe-task-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
          />
        </svg>
      </span>
    </div>
    <div
      class="swipe-task-front"
      role="group"
      aria-label="Task card. Swipe right to edit or left to delete."
      style="transform: translate3d({visual}px, 0, 0); transition: {dragging
        ? 'none'
        : 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)'}"
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerUp}
    >
      <slot />
    </div>
  </div>
{/if}
