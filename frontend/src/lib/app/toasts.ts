import type { ToastType } from './types'

export function toastDurationMs(type: ToastType): number {
  if (type === 'error') return 5000
  if (type === 'warning') return 4000
  return 3000
}
