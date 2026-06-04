import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import Toasts from '../../src/components/notifications/Toasts.svelte'

describe('Toasts', () => {
  it('renders toasts and dismiss button', async () => {
    const dismissToast = vi.fn()
    const user = userEvent.setup()

    const { getByRole, getByText, container } = render(Toasts, {
      props: {
        toasts: [
          {
            id: 1,
            message: 'Something happened',
            type: 'error',
            timeoutId: setTimeout(() => {}, 1),
            exiting: true,
          },
        ],
        dismissToast,
      },
    })

    expect(getByRole('alert')).toBeVisible()
    expect(getByText('Something happened')).toBeVisible()
    expect(container.querySelector('.toast--exiting')).toBeTruthy()

    await user.click(getByRole('button', { name: 'Dismiss' }))
    expect(dismissToast).toHaveBeenCalledWith(1)
  })
})

