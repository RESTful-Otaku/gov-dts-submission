import { slide, fade, fly } from 'svelte/transition'
import { cubicOut } from 'svelte/easing'

/** Create/edit modal: fade on web, slide from left on narrow (drawer). */
export function modalContentTransition(
  node: HTMLElement,
  params: { isNarrow?: boolean },
): ReturnType<typeof slide> | ReturnType<typeof fade> {
  if (params.isNarrow) return slide(node, { duration: 260, easing: cubicOut, axis: 'x' })
  return fade(node, { duration: 200 })
}

/**
 * Help centre: always enters from the right (matches the ? control).
 * Offset scales with viewport so the panel clears the screen edge.
 */
export function helpModalContentTransition(
  node: HTMLElement,
  params: { isNarrow?: boolean },
): ReturnType<typeof fly> {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const x = params.isNarrow ? vw : Math.min(Math.max(vw * 0.42, 360), 640)
  return fly(node, {
    x,
    duration: params.isNarrow ? 280 : 300,
    easing: cubicOut,
  })
}
