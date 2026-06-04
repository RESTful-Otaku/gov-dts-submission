import { describe, expect, it } from 'vitest'
import { resolveBootstrapState, toPersistedTaskUiState } from '../../src/lib/app/task-app/bootstrapState'

describe('bootstrapState helpers', () => {
  it('resolves theme and startup view mode precedence', () => {
    const defaults = {
      theme: 'light' as const,
      fontSize: 'md' as const,
      viewMode: 'cards' as const,
      sortKey: 'due' as const,
      sortAscending: true,
      statusFilter: 'all' as const,
      priorityFilter: 'all' as const,
      ownerFilter: '',
      tagFilters: [],
      searchTerm: '',
      debouncedSearchTerm: '',
      filterFrom: '',
      filterTo: '',
      showFilters: false,
      density: 'comfortable' as const,
      motionPreference: 'system' as const,
      startupViewMode: 'remember' as const,
      defaultSortKey: 'due' as const,
      defaultSortAscending: true,
    }

    const resolved = resolveBootstrapState({
      boot: {
        theme: 'dark',
        startupViewMode: 'list',
        viewMode: 'cards',
        sortKey: 'priority',
        sortAscending: false,
      },
      defaults,
      isNarrow: false,
      isNativePlatform: false,
      systemTheme: () => 'light',
    })

    expect(resolved.theme).toBe('dark')
    // startup view overrides remembered view mode when not "remember".
    expect(resolved.viewMode).toBe('list')
    expect(resolved.sortKey).toBe('priority')
    expect(resolved.sortAscending).toBe(false)
  })

  it('uses system theme fallback on narrow/native when no stored theme', () => {
    const resolved = resolveBootstrapState({
      boot: {},
      defaults: {
        theme: 'light',
        fontSize: 'md',
        viewMode: 'cards',
        sortKey: 'due',
        sortAscending: true,
        statusFilter: 'all',
        priorityFilter: 'all',
        ownerFilter: '',
        tagFilters: [],
        searchTerm: '',
        debouncedSearchTerm: '',
        filterFrom: '',
        filterTo: '',
        showFilters: false,
        density: 'comfortable',
        motionPreference: 'system',
        startupViewMode: 'remember',
        defaultSortKey: 'due',
        defaultSortAscending: true,
      },
      isNarrow: true,
      isNativePlatform: false,
      systemTheme: () => 'dark',
    })

    expect(resolved.theme).toBe('dark')
  })

  it('normalizes persisted UI state by cloning mutable arrays', () => {
    const state = toPersistedTaskUiState({
      viewMode: 'cards',
      sortKey: 'due',
      sortAscending: true,
      statusFilter: 'all',
      priorityFilter: 'all',
      ownerFilter: '',
      tagFilters: ['alpha'],
      searchTerm: 'x',
      filterFrom: '',
      filterTo: '',
      showFilters: false,
    })

    expect(state).toEqual({
      viewMode: 'cards',
      sortKey: 'due',
      sortAscending: true,
      statusFilter: 'all',
      priorityFilter: 'all',
      ownerFilter: '',
      tagFilters: ['alpha'],
      searchTerm: 'x',
      filterFrom: '',
      filterTo: '',
      showFilters: false,
    })
  })
})
