import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../src/lib/api'
import * as api from '../../src/lib/api'
import { refreshHealthState } from '../../src/lib/app/health'

describe('refreshHealthState', () => {
  it('maps ready to ok', async () => {
    vi.spyOn(api, 'healthReady').mockResolvedValue({ status: 'ready' })
    await expect(refreshHealthState()).resolves.toEqual({
      healthStatus: 'ok',
      healthMessage: '',
    })
  })

  it('maps non-ready to degraded', async () => {
    vi.spyOn(api, 'healthReady').mockResolvedValue({ status: 'warming' })
    await expect(refreshHealthState()).resolves.toEqual({
      healthStatus: 'degraded',
      healthMessage: 'Service is responding but not fully ready.',
    })
  })

  it('maps errors to down', async () => {
    vi.spyOn(api, 'healthReady').mockRejectedValue(new ApiError({ status: 503, message: 'nope' }))
    await expect(refreshHealthState()).resolves.toEqual({
      healthStatus: 'down',
      healthMessage: 'nope',
    })
  })
})
