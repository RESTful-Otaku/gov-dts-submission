import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import ClearFiltersButton from '../../src/components/filters/ClearFiltersButton.svelte'

describe('ClearFiltersButton', () => {
  it('calls clear when visible', async () => {
    const clearAllFilters = vi.fn()
    const { getByRole } = render(ClearFiltersButton, {
      props: { hasActiveFilters: true, clearAllFilters },
    })
    await fireEvent.click(getByRole('button', { name: 'Clear all filters' }))
    expect(clearAllFilters).toHaveBeenCalled()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(ClearFiltersButton, {
      props: { hasActiveFilters: false, clearAllFilters: vi.fn() },
    })
    expect(container.querySelector('.btn-clear-filters')).toBeNull()
  })
})
