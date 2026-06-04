import { describe, expect, it } from 'vitest'
import { toastDurationMs } from '../../src/lib/app/toasts'

describe('toasts', () => {
  it('toastDurationMs', () => {
    expect(toastDurationMs('error')).toBe(5000)
    expect(toastDurationMs('warning')).toBe(4000)
    expect(toastDurationMs('notification')).toBe(3000)
  })
})
