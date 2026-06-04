import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import ModalHeader from '../../src/components/modals/ModalHeader.svelte'

describe('ModalHeader', () => {
  it('shows title and closes', async () => {
    const onClose = vi.fn()
    const { getByRole, getByText } = render(ModalHeader, {
      props: { titleId: 'mh', title: 'Hello', onClose },
    })
    expect(getByText('Hello')).toBeVisible()
    await fireEvent.click(getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
