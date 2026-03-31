import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetPlatform } = vi.hoisted(() => ({
  mockGetPlatform: vi.fn(() => 'web' as 'web' | 'ios' | 'android'),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mockGetPlatform(),
  },
}))

import { isNativeMobileSQLiteEnabled } from '../src/lib/mobile-sqlite'

describe('isNativeMobileSQLiteEnabled', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    mockGetPlatform.mockReturnValue('web')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is false on web when env is unset', () => {
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', '')
    expect(isNativeMobileSQLiteEnabled()).toBe(false)
  })

  it('is false on web even when env suggests local db', () => {
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', 'true')
    expect(isNativeMobileSQLiteEnabled()).toBe(false)
  })

  it('is true on native when env is unset (default self-contained demo)', () => {
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', '')
    mockGetPlatform.mockReturnValue('ios')
    expect(isNativeMobileSQLiteEnabled()).toBe(true)
  })

  it('is true on native when the flag is explicitly true', () => {
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', 'true')
    mockGetPlatform.mockReturnValue('ios')
    expect(isNativeMobileSQLiteEnabled()).toBe(true)
  })

  it('is false on native when explicitly opted out', () => {
    mockGetPlatform.mockReturnValue('android')
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', 'false')
    expect(isNativeMobileSQLiteEnabled()).toBe(false)
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', '0')
    expect(isNativeMobileSQLiteEnabled()).toBe(false)
  })

  it('accepts 1 and yes as redundant affirmative flags on native', () => {
    mockGetPlatform.mockReturnValue('android')
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', '1')
    expect(isNativeMobileSQLiteEnabled()).toBe(true)
    vi.stubEnv('VITE_MOBILE_LOCAL_DB', 'yes')
    expect(isNativeMobileSQLiteEnabled()).toBe(true)
  })
})
