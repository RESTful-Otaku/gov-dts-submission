<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import type { HelpTabId, OnboardingStepId } from '../../lib/app/onboarding/types'
  import type { TourStepDef } from '../../lib/app/onboarding/types'
  import { getSafeAreaInsetsPx } from '../../lib/dom/safeAreaInsets'

  export let isNarrow: boolean
  /** Remeasure when Help opens or the active tab changes (settings targets mount after the tour step). */
  export let helpModalOpen = false
  export let helpActiveTab: HelpTabId = 'profile'
  /** When this toggles (e.g. mobile toolbar collapse), spotlight geometry must update. */
  export let mobileSearchExpanded = false
  export let tourStepIndex: number
  export let tourSteps: TourStepDef[]
  export let checklist: Record<OnboardingStepId, boolean>
  export let checklistDone: number
  export let checklistTotal: number

  export let stopTour: () => void
  export let nextTourStep: () => void
  export let prevTourStep: () => void
  export let markOnboardingStep: (id: OnboardingStepId) => void

  const PAD = 10
  const COLLAPSE_MS = 3200
  /** Narrow + interactive: shrink sooner so the coach sheet does not sit over the control for long. */
  const COLLAPSE_MS_NARROW_INTERACTIVE = 1500

  function useCenterScroll(attr: string | null): boolean {
    return attr != null && (attr === 'filter-sort' || attr.startsWith('help-settings'))
  }

  /** Prefer a visible, hit-testable node (skips mobile filter row while search is expanded). */
  function pickTourTargetElement(safe: string, attr: string | null): HTMLElement | null {
    const nodes = document.querySelectorAll(`[data-tour="${safe}"]`)
    const relaxOpacity = attr?.startsWith('help-settings') ?? false
    let first: HTMLElement | null = null
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (!(n instanceof HTMLElement)) continue
      if (!first) first = n
      const st = getComputedStyle(n)
      if (st.display === 'none') continue
      if (st.visibility === 'hidden') continue
      if (!relaxOpacity && Number.parseFloat(st.opacity) < 0.02) continue
      const r = n.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      return n
    }
    return relaxOpacity ? first : null
  }

  let helpRemeasureTimers: ReturnType<typeof setTimeout>[] = []
  function clearHelpRemeasureTimers(): void {
    for (const t of helpRemeasureTimers) clearTimeout(t)
    helpRemeasureTimers = []
  }

  let useSpotlight = false
  let mobilePlacement: 'top' | 'bottom' = 'bottom'
  let topH = 0
  let midTop = 0
  let midH = 0
  let leftW = 0
  let rightLeft = 0
  let rightW = 0
  let bottomTop = 0
  let bottomH = 0
  let holeTop = 0
  let holeLeft = 0
  let holeW = 0
  let holeH = 0
  let coachTop = 0
  let coachLeft = 0
  let coachWidth = 340
  let coachCollapsed = false
  let collapseTimer: ReturnType<typeof setTimeout> | null = null
  /** Points toward the target: compact bar above hole → 'down', bar below → 'up' */
  let nudgeDir: 'up' | 'down' = 'down'

  $: step = tourSteps[tourStepIndex] ?? null
  $: targetAttr = step?.targetTourAttr ?? null
  $: progressPct = checklistTotal > 0 ? Math.round((100 * checklistDone) / checklistTotal) : 0
  $: isLastStep = tourStepIndex >= tourSteps.length - 1

  $: {
    tourStepIndex
    targetAttr
    isNarrow
    step?.id
    mobileSearchExpanded
    helpModalOpen
    helpActiveTab
    clearHelpRemeasureTimers()
    tick().then(() => runMeasure(true))
  }

  $: {
    tourStepIndex
    step?.id
    step?.interactive
    isNarrow
    checklist
    if (collapseTimer) {
      clearTimeout(collapseTimer)
      collapseTimer = null
    }
    coachCollapsed = false
    const s = tourSteps[tourStepIndex]
    if (s?.interactive && !stepSatisfied(s)) {
      const ms = isNarrow ? COLLAPSE_MS_NARROW_INTERACTIVE : COLLAPSE_MS
      collapseTimer = setTimeout(() => {
        coachCollapsed = true
        collapseTimer = null
      }, ms)
    }
  }

  function stepSatisfied(s: TourStepDef | null): boolean {
    if (!s) return true
    if (!s.interactive) return true
    return !!checklist[s.id]
  }

  function clearSpotlightClass(): void {
    document.querySelectorAll('.onboarding-spotlight-target').forEach((n) => {
      n.classList.remove('onboarding-spotlight-target')
    })
  }

  /** `scrollIntoView` only when the step/layout changes — not on window scroll/resize (avoids fighting the user). */
  function runMeasure(scrollTarget: boolean, fromDeferredRemeasure = false): void {
    clearSpotlightClass()
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (!targetAttr) {
      useSpotlight = false
      mobilePlacement = 'bottom'
      return
    }

    const safe = targetAttr.replace(/["\\]/g, '')

    if (targetAttr === 'filter' && isNarrow && mobileSearchExpanded && !fromDeferredRemeasure) {
      helpRemeasureTimers.push(
        window.setTimeout(() => runMeasure(scrollTarget, true), 0),
        window.setTimeout(() => runMeasure(scrollTarget, true), 48),
      )
      useSpotlight = false
      mobilePlacement = 'bottom'
      return
    }

    const el = pickTourTargetElement(safe, targetAttr)
    if (!el) {
      if (targetAttr.startsWith('help-settings') && !fromDeferredRemeasure) {
        for (const delay of [40, 120, 260, 420]) {
          helpRemeasureTimers.push(window.setTimeout(() => runMeasure(true, true), delay))
        }
      }
      useSpotlight = false
      mobilePlacement = 'bottom'
      return
    }

    const applyGeometry = (): void => {
      const el2 = pickTourTargetElement(safe, targetAttr)
      if (!el2) {
        useSpotlight = false
        mobilePlacement = 'bottom'
        return
      }

      el2.classList.add('onboarding-spotlight-target')
      const r = el2.getBoundingClientRect()
      holeTop = r.top - PAD
      holeLeft = r.left - PAD
      holeW = r.width + PAD * 2
      holeH = r.height + PAD * 2

      const hl = Math.max(0, holeLeft)
      const hr = Math.max(0, vw - holeLeft - holeW)

      useSpotlight = true
      topH = Math.max(0, holeTop)
      midTop = holeTop
      midH = holeH
      leftW = hl
      rightLeft = holeLeft + holeW
      rightW = hr
      bottomTop = holeTop + holeH
      bottomH = Math.max(0, vh - holeTop - holeH)

      const cy = holeTop + holeH / 2
      const holeBottom = holeTop + holeH
      const { top: insetTop } = getSafeAreaInsetsPx()
      const bottomReserve = Math.min(vh * 0.42, 300)
      const topReserve = Math.min(vh * 0.24, 160) + insetTop
      if (isNarrow) {
        let placeBottom = cy <= vh * 0.5
        const interactiveOpen = !!step?.interactive && !stepSatisfied(step)
        if (interactiveOpen) {
          if (placeBottom && holeBottom > vh - bottomReserve) placeBottom = false
          if (!placeBottom && holeTop < topReserve) placeBottom = true
        } else {
          placeBottom = cy <= vh * 0.52
        }
        mobilePlacement = placeBottom ? 'bottom' : 'top'
        nudgeDir = mobilePlacement === 'top' ? 'down' : 'up'
      } else {
        nudgeDir = cy < vh * 0.45 ? 'down' : 'up'
      }

      if (!isNarrow && !coachCollapsed) {
        void tick().then(() => positionDesktopCoach(r))
      }
    }

    if (scrollTarget) {
      const block = useCenterScroll(targetAttr) ? 'center' : 'nearest'
      el.scrollIntoView({ block, inline: 'nearest', behavior: 'auto' })
      const tripleSettle = useCenterScroll(targetAttr) || targetAttr === 'filter'
      requestAnimationFrame(() => {
        if (tripleSettle) {
          requestAnimationFrame(() => {
            requestAnimationFrame(applyGeometry)
          })
        } else {
          requestAnimationFrame(applyGeometry)
        }
      })
    } else {
      applyGeometry()
    }
  }

  function positionDesktopCoach(r: DOMRect): void {
    const { top: sat, right: sar, bottom: sab, left: sal } = getSafeAreaInsetsPx()
    const edge = 16
    coachWidth = Math.min(360, window.innerWidth - sal - sar - edge * 2)
    const panel = document.querySelector('.tour-coach-panel') as HTMLElement | null
    const ph = panel?.offsetHeight ?? 220
    let top = r.bottom + 16
    if (top + ph > window.innerHeight - sab - 20) {
      top = r.top - ph - 16
    }
    const minTop = sat + 12
    if (top < minTop) top = minTop
    let left = r.left + r.width / 2 - coachWidth / 2
    left = Math.max(sal + edge, Math.min(left, window.innerWidth - coachWidth - sar - edge))
    coachTop = top
    coachLeft = left
  }

  function manualMark(): void {
    if (!step) return
    markOnboardingStep(step.id)
  }

  function expandCoach(): void {
    coachCollapsed = false
    if (collapseTimer) {
      clearTimeout(collapseTimer)
      collapseTimer = null
    }
    void tick().then(() => runMeasure(false))
  }

  onDestroy(() => {
    if (collapseTimer) clearTimeout(collapseTimer)
    clearHelpRemeasureTimers()
    clearSpotlightClass()
  })
</script>

<svelte:window on:scroll|capture={() => runMeasure(false)} on:resize={() => runMeasure(false)} />

{#if step}
<div class="tour-coach-root" role="presentation">
  {#if !useSpotlight}
    <div class="tour-barrier tour-barrier--full" aria-hidden="true"></div>
  {:else}
    <div
      class="tour-barrier tour-barrier--segment"
      style={`top:0;left:0;width:100%;height:${topH}px`}
      aria-hidden="true"
    ></div>
    <div
      class="tour-barrier tour-barrier--segment"
      style={`top:${midTop}px;left:0;width:${leftW}px;height:${midH}px`}
      aria-hidden="true"
    ></div>
    <div
      class="tour-barrier tour-barrier--segment"
      style={`top:${midTop}px;left:${rightLeft}px;width:${rightW}px;height:${midH}px`}
      aria-hidden="true"
    ></div>
    <div
      class="tour-barrier tour-barrier--segment"
      style={`top:${bottomTop}px;left:0;width:100%;height:${bottomH}px`}
      aria-hidden="true"
    ></div>
    <div
      class="tour-hole-ring"
      style={`top:${holeTop}px;left:${holeLeft}px;width:${holeW}px;height:${holeH}px`}
      aria-hidden="true"
    ></div>
    <div
      class="tour-nudge"
      style={`top:${holeTop + holeH / 2 - 18}px;left:${holeLeft + holeW / 2 - 18}px`}
      aria-hidden="true"
    >
      <span class="tour-nudge-ring"></span>
    </div>
  {/if}

    {#if coachCollapsed && step.interactive && !stepSatisfied(step)}
      <div
        class="tour-coach-compact"
        class:tour-coach-compact--mobile-top={isNarrow && mobilePlacement === 'top'}
        class:tour-coach-compact--mobile-bottom={isNarrow && mobilePlacement === 'bottom'}
        class:tour-coach-compact--desktop={!isNarrow}
        role="region"
        aria-label="Tour hint"
        transition:fly={{
          y: isNarrow ? (mobilePlacement === 'top' ? -16 : 16) : -8,
          duration: 280,
          easing: cubicOut,
        }}
      >
        {#if nudgeDir === 'up'}
          <span class="tour-coach-compact-arrow tour-coach-compact-arrow--up" aria-hidden="true"></span>
        {/if}
        <div class="tour-coach-compact-main">
          <span class="tour-coach-compact-step">Step {tourStepIndex + 1}/{tourSteps.length}</span>
          <span class="tour-coach-compact-title">{step.title}</span>
        </div>
        <p class="tour-coach-compact-hint">Use the glowing control — the tour continues when you’re done.</p>
        <div class="tour-coach-compact-actions">
          <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={expandCoach}>Hint</button>
          <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={prevTourStep} disabled={tourStepIndex <= 0}>
            Back
          </button>
          <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={manualMark}>Skip step</button>
          <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={stopTour}>Exit</button>
        </div>
        {#if nudgeDir === 'down'}
          <span class="tour-coach-compact-arrow" aria-hidden="true"></span>
        {/if}
      </div>
    {:else}
      {#key tourStepIndex}
        <div
          class="tour-coach-panel"
          class:tour-coach-panel--mobile={isNarrow}
          class:tour-coach-panel--mobile-top={isNarrow && mobilePlacement === 'top'}
          class:tour-coach-panel--interactive-mobile={isNarrow && !!step?.interactive && !coachCollapsed}
          style={isNarrow ? '' : `top:${coachTop}px;left:${coachLeft}px;width:${coachWidth}px`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-coach-title"
          transition:fly={{
            y: isNarrow ? (mobilePlacement === 'top' ? -28 : 32) : 20,
            duration: 300,
            easing: cubicOut,
          }}
        >
          <p class="tour-coach-meta" aria-live="polite">
            Step {tourStepIndex + 1} of {tourSteps.length} · {checklistDone}/{checklistTotal} checklist
          </p>
          <div class="tour-coach-progress" aria-hidden="true">
            <div class="tour-coach-progress-fill" style={`width: ${progressPct}%`}></div>
          </div>
          <h2 id="tour-coach-title" class="tour-coach-title">{step.title}</h2>
          <p class="tour-coach-body">{step.body}</p>
          {#if step.interactive}
            {#if stepSatisfied(step)}
              <p class="tour-coach-hint tour-coach-hint--ok" aria-live="assertive">Done — moving to the next step…</p>
            {:else}
              <p class="tour-coach-hint">
                Try the control now. This step completes automatically, or use “mark complete” if you already did it.
              </p>
              <button type="button" class="tour-coach-link" on:click={manualMark}>I already did this — mark complete</button>
            {/if}
          {/if}
          <div class="tour-coach-actions">
            <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={prevTourStep} disabled={tourStepIndex <= 0}>
              Back
            </button>
            {#if !step.interactive}
              <button type="button" class="tour-coach-btn tour-coach-btn--primary" on:click={nextTourStep}>
                {isLastStep ? 'Finish tour' : 'Next'}
              </button>
            {/if}
            <button type="button" class="tour-coach-btn tour-coach-btn--ghost" on:click={stopTour}>Exit</button>
          </div>
        </div>
      {/key}
    {/if}
</div>
{/if}
