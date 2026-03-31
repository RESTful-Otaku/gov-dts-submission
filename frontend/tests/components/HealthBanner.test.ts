import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import HealthBanner from '../../src/components/health/HealthBanner.svelte'

describe('HealthBanner', () => {
  it('renders down banner message and indicator', () => {
    const refreshHealth = vi.fn()
    const { getByRole, getByText, container } = render(HealthBanner, {
      props: {
        healthStatus: 'down',
        healthMessage: 'Service unreachable',
        refreshHealth,
      },
    })

    expect(getByRole('status')).toBeVisible()
    expect(getByText('The service is currently unavailable.')).toBeVisible()
    expect(getByText('Service unreachable')).toBeVisible()
    expect(container.querySelector('.health-indicator--down')).toBeTruthy()
  })

  it('calls refreshHealth on retry click', async () => {
    const refreshHealth = vi.fn()
    const user = userEvent.setup()

    const { getByRole } = render(HealthBanner, {
      props: {
        healthStatus: 'degraded',
        healthMessage: '',
        refreshHealth,
      },
    })

    await user.click(getByRole('button', { name: 'Retry' }))
    expect(refreshHealth).toHaveBeenCalledTimes(1)
  })
})

