import { describe, expect, it } from 'vitest'
import { computeStickyChromeCollapsed } from '../../src/lib/app/task-app/stickyChrome'

describe('computeStickyChromeCollapsed', () => {
  it('always expands while tour is running', () => {
    expect(computeStickyChromeCollapsed(999, false, true, true)).toBe(false)
  })

  it('collapses and expands at thresholds', () => {
    expect(computeStickyChromeCollapsed(20, false, true, false)).toBe(false)
    expect(computeStickyChromeCollapsed(90, false, false, false)).toBe(true)
  })

  it('keeps previous state inside hysteresis band unless resolving', () => {
    expect(computeStickyChromeCollapsed(55, false, true, false)).toBe(true)
    expect(computeStickyChromeCollapsed(55, false, false, false)).toBe(false)
    expect(computeStickyChromeCollapsed(55, true, false, false)).toBe(false)
    expect(computeStickyChromeCollapsed(60, true, false, false)).toBe(true)
  })
})
