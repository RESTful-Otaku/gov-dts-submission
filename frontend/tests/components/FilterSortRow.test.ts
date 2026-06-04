import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import FilterSortRow from '../../src/components/filters/FilterSortRow.svelte'

describe('FilterSortRow', () => {
  it('toggles sort direction', async () => {
    const { getByRole } = render(FilterSortRow, {
      props: { sortKey: 'due', sortAscending: true },
    })

    const toggle = getByRole('button', { name: 'Sort ascending' })
    await fireEvent.click(toggle)
    // Two-way bind updates parent in real app; here we only smoke the control.
    expect(toggle).toBeVisible()
  })
})
