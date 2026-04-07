/**
 * Sticky chrome hysteresis:
 * - expand near top
 * - collapse past lower bound
 * - keep previous state inside the band unless resolveBand is requested
 */
export function computeStickyChromeCollapsed(
  y: number,
  resolveBand: boolean,
  previousCollapsed: boolean,
  tourRunning: boolean,
): boolean {
  if (tourRunning) return false

  const expandBelowY = 44
  const collapseAboveY = 72
  const bandMidY = 58

  if (y <= expandBelowY) return false
  if (y >= collapseAboveY) return true
  if (resolveBand) return y >= bandMidY
  return previousCollapsed
}
