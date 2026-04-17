import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import ViewModeToggle from '../../src/components/tasks/ViewModeToggle.svelte'

describe('ViewModeToggle', () => {
  it('invokes onSetViewMode', async () => {
    const onSetViewMode = vi.fn()
    const { getByRole } = render(ViewModeToggle, {
      props: { viewMode: 'cards', onSetViewMode },
    })
    await fireEvent.click(getByRole('button', { name: 'List' }))
    expect(onSetViewMode).toHaveBeenCalledWith('list')
  })
})
