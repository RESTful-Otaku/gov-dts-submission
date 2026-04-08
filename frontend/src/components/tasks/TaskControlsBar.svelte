<script lang="ts" context="module">
  export type { ViewMode } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { ActiveFilterChip, ActiveFilterChipKind, ViewMode } from '../../lib/app/types'
  import { UI_COPY } from '../../lib/app/copy'

  import HelpMenuTriggerButton from '../help/HelpMenuTriggerButton.svelte'
  import AdminMainTabToggle from './AdminMainTabToggle.svelte'
  import TaskSearchField from './TaskSearchField.svelte'
  import ViewModeToggle from './ViewModeToggle.svelte'

  export let isNarrow: boolean
  export let mobileSearchExpanded: boolean
  /** Shown when sticky header branding is collapsed; hidden during narrow expanded search. */
  export let showBackToTop = false
  export let onScrollToTop: () => void = () => {}
  export let showFilters: boolean
  export let viewMode: ViewMode
  export let isAdmin = false
  /** When false, Tasks / Users / Audit toggle is hidden (narrow viewport or native app). */
  export let adminTabsAvailable = true
  export let canMutateTasks = true
  export let activeMainTab: 'tasks' | 'users' | 'audit' = 'tasks'
  export let searchTerm: string

  export let searchInput: HTMLInputElement | null

  export let onCreateClick: () => void
  export let onSetMainTab: (tab: 'tasks' | 'users' | 'audit') => void = () => {}
  export let onToggleFilters: () => void
  export let onSetViewMode: (next: ViewMode) => void
  export let onSearchTermChange: (next: string) => void
  export let onExpandMobileSearch: () => void
  export let onCollapseMobileSearch: () => void

  export let hasActiveFilters: boolean
  export let onClearAllFilters: () => void
  export let activeFilterChips: ActiveFilterChip[] = []
  export let onRemoveActiveFilterChip: (id: string, kind: ActiveFilterChipKind) => void = () => {}

  export let showMenuInToolbar = false
  /** Hide profile / help trigger when signed out (e.g. auth-required mode without a session). */
  export let showUserMenu = true
  export let menuOpen = false
  export let menuInitials = ''
  export let onToggleMenu: () => void = () => {}

  $: backToTopVisible = showBackToTop && !(isNarrow && mobileSearchExpanded)
  $: menuInToolbarVisible = showMenuInToolbar && showUserMenu && !(isNarrow && mobileSearchExpanded)
</script>

<div
  class="task-controls-wrap"
  class:task-controls-wrap--mobile-search-open={isNarrow && mobileSearchExpanded}
>
  <div class="task-controls" data-tour="toolbar" aria-label={UI_COPY.tasks.controlsAria}>
    <div class="task-controls-left" class:task-controls-left--narrow={isNarrow}>
      {#if isNarrow}
        <div
          class="task-controls-mobile-expandable"
          class:task-controls-mobile-expandable--open={mobileSearchExpanded}
        >
          <div class="task-controls-mobile-toolbar">
            {#if canMutateTasks}
              <button
                type="button"
                class="btn-create btn-icon-compact"
                data-tour="create"
                on:click|preventDefault|stopPropagation={onCreateClick}
                aria-label={UI_COPY.tasks.createTaskAria}
                title={UI_COPY.tasks.createTaskAria}
              >
                <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
                <span class="btn-icon-compact__label">{UI_COPY.tasks.createTask}</span>
              </button>
            {/if}
            <div class="task-controls-mobile-search-slot">
              <TaskSearchField
                bind:searchInput
                {searchTerm}
                placeholder={UI_COPY.tasks.searchPlaceholderCompact}
                title={UI_COPY.tasks.searchTitle}
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
                  aria-label={UI_COPY.tasks.clearFiltersAria}
                  title={UI_COPY.tasks.clearFiltersTitle}
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
                  <span class="btn-icon-compact__label clear-filters-label clear-filters-label--full">{UI_COPY.tasks.clearFilters}</span>
                  <span class="btn-icon-compact__label clear-filters-label clear-filters-label--short">{UI_COPY.tasks.clear}</span>
                </button>
              {/if}
              <button
                type="button"
                class="btn-filter"
                data-tour="filter"
                on:click|preventDefault|stopPropagation={onToggleFilters}
                aria-expanded={showFilters}
                aria-controls="advanced-filters"
                aria-label={UI_COPY.tasks.toggleFiltersAria}
                title={UI_COPY.tasks.toggleFiltersTitle}
              >
                <span class="filter-icon" aria-hidden="true"></span>
              </button>
              {#if backToTopVisible}
                <button
                  type="button"
                  class="btn-back-to-top btn-icon-compact"
                  on:click|preventDefault|stopPropagation={onScrollToTop}
                  aria-label={UI_COPY.tasks.backToTop}
                  title={UI_COPY.tasks.backToTop}
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">↑</span>
                </button>
              {/if}
              {#if menuInToolbarVisible && showUserMenu}
                <HelpMenuTriggerButton {menuOpen} {onToggleMenu} initials={menuInitials} inToolbar />
              {/if}
            </div>
          </div>
          {#if isAdmin && adminTabsAvailable}
            <div class="task-controls-admin-mobile task-controls-admin-mobile--divided">
              <AdminMainTabToggle {activeMainTab} {onSetMainTab} />
            </div>
          {/if}
        </div>
      {:else}
        {#if canMutateTasks}
          <button
            type="button"
            class="btn-create btn-icon-compact"
            data-tour="create"
            on:click|preventDefault|stopPropagation={onCreateClick}
            aria-label={UI_COPY.tasks.createTaskAria}
            title={UI_COPY.tasks.createTaskAria}
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
            <span class="btn-icon-compact__label">{UI_COPY.tasks.createTask}</span>
          </button>
        {/if}
        <ViewModeToggle {viewMode} {onSetViewMode} />
        {#if isAdmin && adminTabsAvailable}
          <span class="task-controls-toolbar-divider" aria-hidden="true"></span>
          <AdminMainTabToggle {activeMainTab} {onSetMainTab} />
        {/if}
        <TaskSearchField
          bind:searchInput
          {searchTerm}
          placeholder={UI_COPY.tasks.searchPlaceholderWide}
          title={UI_COPY.tasks.searchTitle}
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
            aria-label={UI_COPY.tasks.clearFiltersAria}
            title={UI_COPY.tasks.clearFiltersTitle}
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
            <span class="btn-icon-compact__label clear-filters-label clear-filters-label--full">{UI_COPY.tasks.clearFilters}</span>
            <span class="btn-icon-compact__label clear-filters-label clear-filters-label--short">{UI_COPY.tasks.clear}</span>
          </button>
        {/if}
        <button
          type="button"
          class="btn-filter"
          data-tour="filter"
          on:click|preventDefault|stopPropagation={onToggleFilters}
          aria-expanded={showFilters}
          aria-controls="advanced-filters"
          aria-label={UI_COPY.tasks.toggleFiltersAria}
          title={UI_COPY.tasks.toggleFiltersTitle}
        >
          <span class="filter-icon" aria-hidden="true"></span>
        </button>
        {#if backToTopVisible}
          <button
            type="button"
            class="btn-back-to-top btn-icon-compact"
            on:click|preventDefault|stopPropagation={onScrollToTop}
            aria-label={UI_COPY.tasks.backToTop}
            title={UI_COPY.tasks.backToTop}
          >
            <span class="btn-icon-compact__icon" aria-hidden="true">↑</span>
            <span class="btn-icon-compact__label btn-back-to-top__label">{UI_COPY.tasks.top}</span>
          </button>
        {/if}
        {#if menuInToolbarVisible && showUserMenu}
          <HelpMenuTriggerButton {menuOpen} {onToggleMenu} initials={menuInitials} inToolbar />
        {/if}
      {/if}
    </div>
  </div>
</div>
{#if activeFilterChips.length > 0}
  <div class="task-active-filters" aria-label={UI_COPY.tasks.activeSummaryAria}>
    {#each activeFilterChips as chip (chip.id)}
      <button
        type="button"
        class="task-active-filter-chip"
        on:click={() => onRemoveActiveFilterChip(chip.id, chip.kind)}
        aria-label={`${UI_COPY.tasks.removeFilterChipPrefix} ${chip.label}`}
        title={`${UI_COPY.tasks.removeFilterChipPrefix} ${chip.label}`}
      >
        <span>{chip.label}</span>
        <span aria-hidden="true">×</span>
      </button>
    {/each}
  </div>
{/if}
