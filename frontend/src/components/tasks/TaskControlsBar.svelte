<script lang="ts" context="module">
  export type { ViewMode } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { ViewMode } from '../../lib/app/types'

  import HelpMenuTriggerButton from '../help/HelpMenuTriggerButton.svelte'
  import TaskSearchField from './TaskSearchField.svelte'
  import ViewModeToggle from './ViewModeToggle.svelte'

  export let isNarrow: boolean
  export let mobileSearchExpanded: boolean
  /** Shown when sticky header branding is collapsed; hidden during narrow expanded search. */
  export let showBackToTop = false
  export let onScrollToTop: () => void = () => {}
  export let showFilters: boolean
  export let viewMode: ViewMode
  export let searchTerm: string

  export let searchInput: HTMLInputElement | null

  export let onCreateClick: () => void
  export let onToggleFilters: () => void
  export let onSetViewMode: (next: ViewMode) => void
  export let onSearchTermChange: (next: string) => void
  export let onExpandMobileSearch: () => void
  export let onCollapseMobileSearch: () => void

  export let hasActiveFilters: boolean
  export let onClearAllFilters: () => void

  export let showMenuInToolbar = false
  export let menuOpen = false
  export let onToggleMenu: () => void = () => {}

  $: backToTopVisible = showBackToTop && !(isNarrow && mobileSearchExpanded)
  $: menuInToolbarVisible = showMenuInToolbar && !(isNarrow && mobileSearchExpanded)
</script>

<div
  class="task-controls-wrap"
  data-tour="toolbar"
  class:task-controls-wrap--mobile-search-open={isNarrow && mobileSearchExpanded}
>
  <div class="task-controls" aria-label="View, search, and sort tasks">
    <div class="task-controls-left" class:task-controls-left--narrow={isNarrow}>
      {#if isNarrow}
        <div
          class="task-controls-mobile-expandable"
          class:task-controls-mobile-expandable--open={mobileSearchExpanded}
        >
          <div class="task-controls-mobile-toolbar">
            <button
              type="button"
              class="btn-create btn-icon-compact"
              data-tour="create"
              on:click|preventDefault|stopPropagation={onCreateClick}
              aria-label="Create a new task"
              title="Create a new task"
            >
              <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
              <span class="btn-icon-compact__label">Create task</span>
            </button>
            <div class="task-controls-mobile-search-slot">
              <TaskSearchField
                bind:searchInput
                {searchTerm}
                placeholder="Search…"
                title="Search by title, description, status, or date"
                expandedMobile={mobileSearchExpanded}
                mobileInline={!mobileSearchExpanded}
                onInput={onSearchTermChange}
                onFocus={() => onExpandMobileSearch()}
                onBlur={() => {
                  if (isNarrow && !searchTerm.trim()) onCollapseMobileSearch()
                }}
              />
            </div>
            <div class="task-controls-mobile-actions">
              {#if hasActiveFilters}
                <button
                  type="button"
                  class="btn-clear-filters btn-clear-filters--toolbar btn-icon-compact"
                  on:click|preventDefault|stopPropagation={onClearAllFilters}
                  aria-label="Clear all filters"
                  title="Clear status, priority, owner, tags, and date filters"
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
                  <span class="btn-icon-compact__label clear-filters-label clear-filters-label--full">Clear filters</span>
                  <span class="btn-icon-compact__label clear-filters-label clear-filters-label--short">Clear</span>
                </button>
              {/if}
              <button
                type="button"
                class="btn-filter"
                data-tour="filter"
                on:click|preventDefault|stopPropagation={onToggleFilters}
                aria-expanded={showFilters}
                aria-controls="advanced-filters"
                aria-label="Toggle filters"
                title="Show or hide filters"
              >
                <span class="filter-icon" aria-hidden="true"></span>
              </button>
              {#if backToTopVisible}
                <button
                  type="button"
                  class="btn-back-to-top btn-icon-compact"
                  on:click|preventDefault|stopPropagation={onScrollToTop}
                  aria-label="Back to top"
                  title="Back to top"
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">↑</span>
                </button>
              {/if}
              {#if menuInToolbarVisible}
                <HelpMenuTriggerButton {menuOpen} {onToggleMenu} inToolbar />
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <button
          type="button"
          class="btn-create btn-icon-compact"
          data-tour="create"
          on:click|preventDefault|stopPropagation={onCreateClick}
          aria-label="Create a new task"
          title="Create a new task"
        >
          <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
          <span class="btn-icon-compact__label">Create task</span>
        </button>
        <ViewModeToggle {viewMode} {onSetViewMode} />
        <TaskSearchField
          bind:searchInput
          {searchTerm}
          placeholder="Title, description..."
          title="Search by title, description, status, or date"
          onInput={onSearchTermChange}
        />
      {/if}
    </div>
    <div class="task-controls-right">
      {#if !isNarrow}
        {#if hasActiveFilters}
          <button
            type="button"
            class="btn-clear-filters btn-clear-filters--toolbar btn-icon-compact"
            on:click|preventDefault|stopPropagation={onClearAllFilters}
            aria-label="Clear all filters"
            title="Clear status, priority, owner, tags, and date filters"
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
            <span class="btn-icon-compact__label clear-filters-label clear-filters-label--full">Clear filters</span>
            <span class="btn-icon-compact__label clear-filters-label clear-filters-label--short">Clear</span>
          </button>
        {/if}
        <button
          type="button"
          class="btn-filter"
          data-tour="filter"
          on:click|preventDefault|stopPropagation={onToggleFilters}
          aria-expanded={showFilters}
          aria-controls="advanced-filters"
          aria-label="Toggle filters"
          title="Show or hide filters"
        >
          <span class="filter-icon" aria-hidden="true"></span>
        </button>
        {#if backToTopVisible}
          <button
            type="button"
            class="btn-back-to-top btn-icon-compact"
            on:click|preventDefault|stopPropagation={onScrollToTop}
            aria-label="Back to top"
            title="Back to top"
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">↑</span>
            <span class="btn-icon-compact__label btn-back-to-top__label">Top</span>
          </button>
        {/if}
        {#if menuInToolbarVisible}
          <HelpMenuTriggerButton {menuOpen} {onToggleMenu} inToolbar />
        {/if}
      {/if}
    </div>
  </div>
</div>
