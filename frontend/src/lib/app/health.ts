import { ApiError, healthReady } from '../api'

export type HealthBannerStatus = 'ok' | 'degraded' | 'down'

export async function refreshHealthState(): Promise<{
  healthStatus: HealthBannerStatus
  healthMessage: string
}> {
  try {
    const res = await healthReady()
    const healthStatus: HealthBannerStatus = res.status === 'ready' ? 'ok' : 'degraded'
    const healthMessage =
      healthStatus === 'ok' ? '' : 'Service is responding but not fully ready.'
    return { healthStatus, healthMessage }
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError({ status: 0, message: 'Service unavailable' })
    return { healthStatus: 'down', healthMessage: err.message }
  }
}
