import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

import { en as pickerEn } from 'svelty-picker/i18n'

import FiltersPanel from '../../src/components/tasks/FiltersPanel.svelte'

describe('FiltersPanel', () => {
  it('renders region and filter controls', () => {
    const clearAllFilters = vi.fn()
    const { getByRole } = render(FiltersPanel, {
      props: {
        statusFilter: 'all',
        priorityFilter: 'all',
        ownerFilter: '',
        tagFilters: [],
        filterFrom: '',
        filterTo: '',
        sortKey: 'due',
        sortAscending: true,
        uniqueOwners: ['Sarah Chen'],
        allTags: ['evidence'],
        hasActiveFilters: false,
        DATE_FORMAT: 'dd-mm-yyyy',
        PICKER_I18N: { ...pickerEn, weekStart: 1 },
        clearAllFilters,
      },
    })

    expect(getByRole('region', { name: 'Advanced filters and sorting' })).toBeVisible()
  })

  it('shows and calls clearAllFilters when active', async () => {
    const clearAllFilters = vi.fn()
    const { getByRole } = render(FiltersPanel, {
      props: {
        statusFilter: 'all',
        priorityFilter: 'all',
        ownerFilter: '',
        tagFilters: [],
        filterFrom: '',
        filterTo: '',
        sortKey: 'due',
        sortAscending: true,
        uniqueOwners: ['Sarah Chen'],
        allTags: ['evidence'],
        hasActiveFilters: true,
        DATE_FORMAT: 'dd-mm-yyyy',
        PICKER_I18N: { ...pickerEn, weekStart: 1 },
        clearAllFilters,
      },
    })

    const btn = getByRole('button', { name: 'Clear all filters' })
    await fireEvent.click(btn)
    expect(clearAllFilters).toHaveBeenCalledTimes(1)
  })
})

