import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import FilterLabeledSelect from '../../src/components/filters/FilterLabeledSelect.svelte'

describe('FilterLabeledSelect', () => {
  it('renders options and binds value', () => {
    const { container, getByRole } = render(FilterLabeledSelect, {
      props: {
        label: 'Status',
        ariaLabel: 'Filter by status',
        value: 'all',
        options: [
          { value: 'all', label: 'All' },
          { value: 'todo', label: 'To do' },
        ],
      },
    })

    expect(getByRole('combobox', { name: 'Filter by status' })).toBeVisible()
    expect(container.querySelector('.control-label')?.textContent).toBe('Status')
  })
})
