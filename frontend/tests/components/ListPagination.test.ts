import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import ListPagination from '../../src/components/tasks/ListPagination.svelte'

describe('ListPagination', () => {
  it('shows page info', () => {
    const { getByText } = render(ListPagination, {
      props: {
        listPage: 1,
        listPageSize: 10,
        totalListPages: 3,
        visibleCount: 25,
        LIST_PAGE_SIZES: [10, 20, 30],
      },
    })
    expect(getByText(/Showing 1–10 of 25/)).toBeVisible()
  })
})
