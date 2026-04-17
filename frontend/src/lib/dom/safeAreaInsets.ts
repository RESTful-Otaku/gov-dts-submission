/** Hidden probe for reading CSS env(safe-area-inset-*) as pixels (iOS / Android WebView / PWA). */
let probe: HTMLDivElement | null = null

function ensureProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined' || !document.body) {
    return null
  }
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = [
      'position:fixed',
      'left:-9999px',
      'top:0',
      'width:1px',
      'height:1px',
      'overflow:hidden',
      'pointer-events:none',
      'visibility:hidden',
      'padding-top:env(safe-area-inset-top,0px)',
      'padding-right:env(safe-area-inset-right,0px)',
      'padding-bottom:env(safe-area-inset-bottom,0px)',
      'padding-left:env(safe-area-inset-left,0px)',
    ].join(';')
    document.body.appendChild(probe)
  }
  return probe
}

export function getSafeAreaInsetsPx(): { top: number; right: number; bottom: number; left: number } {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  try {
    const el = ensureProbe()
    if (!el) {
      return { top: 0, right: 0, bottom: 0, left: 0 }
    }
    const s = getComputedStyle(el)
    return {
      top: parseFloat(s.paddingTop) || 0,
      right: parseFloat(s.paddingRight) || 0,
      bottom: parseFloat(s.paddingBottom) || 0,
      left: parseFloat(s.paddingLeft) || 0,
    }
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
}
