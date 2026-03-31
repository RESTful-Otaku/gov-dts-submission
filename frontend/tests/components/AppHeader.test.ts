import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import AppHeader from '../../src/components/layout/AppHeader.svelte'

describe('AppHeader', () => {
  it('renders brand and menu button', () => {
    const onToggleMenu = vi.fn()
    const { getByRole, getByText } = render(AppHeader, {
      props: {
        menuOpen: false,
        onToggleMenu,
      },
    })

    expect(getByRole('heading', { name: 'Caseworker task manager' })).toBeVisible()
    expect(getByText('Capture, prioritise, and complete tasks.')).toBeVisible()

    expect(getByRole('button', { name: 'Open menu' })).toBeVisible()
  })

  it('invokes callback when toggling menu', async () => {
    const user = userEvent.setup()
    const onToggleMenu = vi.fn()

    const { getByRole } = render(AppHeader, {
      props: {
        menuOpen: false,
        onToggleMenu,
      },
    })

    await user.click(getByRole('button', { name: 'Open menu' }))
    expect(onToggleMenu).toHaveBeenCalledTimes(1)
  })
})

