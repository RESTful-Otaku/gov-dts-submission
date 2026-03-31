import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, render } from '@testing-library/svelte'

import TaskControlsBar from '../../src/components/tasks/TaskControlsBar.svelte'

describe('TaskControlsBar', () => {
  it('renders create button and view toggle for web layout', () => {
    const onCreateClick = vi.fn()
    const onToggleFilters = vi.fn()
    const onSetViewMode = vi.fn()
    const onSearchTermChange = vi.fn()

    const { getByRole } = render(TaskControlsBar, {
      props: {
        isNarrow: false,
        mobileSearchExpanded: false,
        showFilters: false,
        viewMode: 'cards',
        searchTerm: '',
        searchInput: null,
        onCreateClick,
        onToggleFilters,
        onSetViewMode,
        onSearchTermChange,
        onExpandMobileSearch: vi.fn(),
        onCollapseMobileSearch: vi.fn(),
        hasActiveFilters: false,
        onClearAllFilters: vi.fn(),
      },
    })

    expect(getByRole('button', { name: 'Create a new task' })).toBeVisible()
    expect(getByRole('button', { name: 'List' })).toBeVisible()
    expect(getByRole('button', { name: 'Toggle filters' })).toBeVisible()
  })

  it('invokes view mode callback when switching views', async () => {
    const user = userEvent.setup()
    const onSetViewMode = vi.fn()

    const { getByRole } = render(TaskControlsBar, {
      props: {
        isNarrow: false,
        mobileSearchExpanded: false,
        showFilters: false,
        viewMode: 'cards',
        searchTerm: '',
        searchInput: null,
        onCreateClick: vi.fn(),
        onToggleFilters: vi.fn(),
        onSetViewMode,
        onSearchTermChange: vi.fn(),
        onExpandMobileSearch: vi.fn(),
        onCollapseMobileSearch: vi.fn(),
        hasActiveFilters: false,
        onClearAllFilters: vi.fn(),
      },
    })

    await user.click(getByRole('button', { name: 'List' }))
    expect(onSetViewMode).toHaveBeenCalledWith('list')
  })

  it('calls mobile search expand/collapse callbacks', async () => {
    const onExpandMobileSearch = vi.fn()
    const onCollapseMobileSearch = vi.fn()

    const { getByRole, rerender } = render(TaskControlsBar, {
      props: {
        isNarrow: true,
        mobileSearchExpanded: false,
        showFilters: true,
        viewMode: 'cards',
        searchTerm: '',
        searchInput: null,
        onCreateClick: vi.fn(),
        onToggleFilters: vi.fn(),
        onSetViewMode: vi.fn(),
        onSearchTermChange: vi.fn(),
        onExpandMobileSearch,
        onCollapseMobileSearch,
        hasActiveFilters: false,
        onClearAllFilters: vi.fn(),
      },
    })

    const searchInput = document.querySelector(
      'input.search-input',
    ) as HTMLInputElement | null
    expect(searchInput).not.toBeNull()
    await fireEvent.focus(searchInput!)
    expect(onExpandMobileSearch).toHaveBeenCalledTimes(1)

    await rerender({
      isNarrow: true,
      mobileSearchExpanded: true,
      showFilters: true,
      viewMode: 'cards',
      searchTerm: '',
      searchInput: null,
      onCreateClick: vi.fn(),
      onToggleFilters: vi.fn(),
      onSetViewMode: vi.fn(),
      onSearchTermChange: vi.fn(),
      onExpandMobileSearch,
      onCollapseMobileSearch,
      hasActiveFilters: false,
      onClearAllFilters: vi.fn(),
    })

    const input = document.querySelector('input.search-input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    input!.dispatchEvent(new Event('blur', { bubbles: true }))

    expect(onCollapseMobileSearch).toHaveBeenCalledTimes(1)
  })

  it('does not collapse mobile search on blur when query is non-empty', async () => {
    const onCollapseMobileSearch = vi.fn()

    render(TaskControlsBar, {
      props: {
        isNarrow: true,
        mobileSearchExpanded: true,
        showFilters: false,
        viewMode: 'cards',
        searchTerm: 'hearing',
        searchInput: null,
        onCreateClick: vi.fn(),
        onToggleFilters: vi.fn(),
        onSetViewMode: vi.fn(),
        onSearchTermChange: vi.fn(),
        onExpandMobileSearch: vi.fn(),
        onCollapseMobileSearch,
        hasActiveFilters: false,
        onClearAllFilters: vi.fn(),
      },
    })

    const input = document.querySelector('input.search-input') as HTMLInputElement | null
    expect(input).not.toBeNull()
    input!.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(onCollapseMobileSearch).not.toHaveBeenCalled()
  })

  it('shows toolbar clear filters control when filters are active and clears on click', async () => {
    const user = userEvent.setup()
    const onClearAllFilters = vi.fn()

    const { getByRole, queryByRole, rerender } = render(TaskControlsBar, {
      props: {
        isNarrow: false,
        mobileSearchExpanded: false,
        showFilters: false,
        viewMode: 'cards',
        searchTerm: '',
        searchInput: null,
        onCreateClick: vi.fn(),
        onToggleFilters: vi.fn(),
        onSetViewMode: vi.fn(),
        onSearchTermChange: vi.fn(),
        onExpandMobileSearch: vi.fn(),
        onCollapseMobileSearch: vi.fn(),
        hasActiveFilters: false,
        onClearAllFilters,
      },
    })

    expect(queryByRole('button', { name: 'Clear all filters' })).toBeNull()

    await rerender({
      isNarrow: false,
      mobileSearchExpanded: false,
      showFilters: false,
      viewMode: 'cards',
      searchTerm: '',
      searchInput: null,
      onCreateClick: vi.fn(),
      onToggleFilters: vi.fn(),
      onSetViewMode: vi.fn(),
      onSearchTermChange: vi.fn(),
      onExpandMobileSearch: vi.fn(),
      onCollapseMobileSearch: vi.fn(),
      hasActiveFilters: true,
      onClearAllFilters,
    })

    await user.click(getByRole('button', { name: 'Clear all filters' }))
    expect(onClearAllFilters).toHaveBeenCalledTimes(1)
  })
})

