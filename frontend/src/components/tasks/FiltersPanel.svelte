<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
  import { UI_COPY } from '../../lib/app/copy'
  import type { TaskPriority, TaskStatus } from '../../lib/api'
  import {
    PRIORITY_OPTIONS as PRIORITY_OPTIONS_META,
    STATUS_OPTIONS as STATUS_OPTIONS_META,
  } from '../../lib/tasks/taskMeta'
  import ClearFiltersButton from '../filters/ClearFiltersButton.svelte'
  import FilterDueDateRange from '../filters/FilterDueDateRange.svelte'
  import FilterLabeledSelect from '../filters/FilterLabeledSelect.svelte'
  import FilterSortRow from '../filters/FilterSortRow.svelte'
  import type { SortKey } from '../../lib/app/types'
  import type { i18nType } from 'svelty-picker/i18n'

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [...STATUS_OPTIONS_META]
  const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [...PRIORITY_OPTIONS_META]

  export let statusFilter: 'all' | TaskStatus
  export let priorityFilter: 'all' | TaskPriority
  export let ownerFilter: string
  export let tagFilters: string[]
  export let filterFrom: string
  export let filterTo: string
  export let sortKey: SortKey
  export let sortAscending: boolean
  export let uniqueOwners: string[]
  export let allTags: string[]
  export let hasActiveFilters: boolean
  export let savedViews: { id: string; name: string }[] = []
  export let selectedSavedViewId = ''

  export let DATE_FORMAT: string
  export let PICKER_I18N: i18nType

  export let clearAllFilters: () => void
  export let onSelectSavedView: (id: string) => void = () => {}
  export let onSaveCurrentView: (name: string) => void = () => {}
  export let onDeleteSavedView: (id: string) => void = () => {}

  let tagAddDraft = ''
  let savedViewNameDraft = ''

  function tagAlreadySelected(name: string): boolean {
    const lower = name.toLowerCase()
    return tagFilters.some((t) => t.toLowerCase() === lower)
  }

  function handleTagSelect(next: string): void {
    if (!next) return
    if (tagAlreadySelected(next)) {
      tagAddDraft = ''
      return
    }
    tagFilters = [...tagFilters, next]
    tagAddDraft = ''
  }

  function removeTagFilter(tag: string): void {
    tagFilters = tagFilters.filter((t) => t !== tag)
  }

  function handleSaveCurrentView(): void {
    onSaveCurrentView(savedViewNameDraft)
    savedViewNameDraft = ''
  }

  $: statusOptions = [
    { value: 'all', label: UI_COPY.tasks.filters.allStatuses },
    ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ]
  $: priorityOptions = [
    { value: 'all', label: UI_COPY.tasks.filters.allPriorities },
    ...PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ]
  $: ownerOptions = [
    { value: '', label: UI_COPY.tasks.filters.allOwners },
    ...uniqueOwners.map((o) => ({ value: o, label: o })),
  ]
  $: tagAddOptions = [
    { value: '', label: UI_COPY.tasks.filters.addTag },
    ...allTags.filter((t) => !tagAlreadySelected(t)).map((t) => ({ value: t, label: t })),
  ]
</script>

<div
  id="advanced-filters"
  class="filters-panel"
  role="region"
  aria-label={UI_COPY.tasks.filters.regionAria}
  transition:slide={{ duration: 220, easing: cubicOut, axis: 'y' }}
>
  <div class="filter-controls">
    <div class="saved-views-controls" role="group" aria-label={UI_COPY.tasks.filters.savedViewsAria}>
      <label>
        <span class="control-label">{UI_COPY.tasks.filters.savedViewsLabel}</span>
        <select
          value={selectedSavedViewId}
          on:change={(e) => onSelectSavedView((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">{UI_COPY.tasks.filters.savedViewsPlaceholder}</option>
          {#each savedViews as view}
            <option value={view.id}>{view.name}</option>
          {/each}
        </select>
      </label>
      <label>
        <span class="control-label">{UI_COPY.tasks.filters.saveCurrentView}</span>
        <input
          type="text"
          bind:value={savedViewNameDraft}
          placeholder={UI_COPY.tasks.filters.savedViewNamePlaceholder}
        />
      </label>
      <button type="button" class="btn-icon-compact" on:click={handleSaveCurrentView}>
        <span class="btn-icon-compact__label">{UI_COPY.tasks.filters.saveCurrentView}</span>
      </button>
      <button
        type="button"
        class="btn-icon-compact"
        disabled={!selectedSavedViewId}
        on:click={() => selectedSavedViewId && onDeleteSavedView(selectedSavedViewId)}
      >
        <span class="btn-icon-compact__label">{UI_COPY.tasks.filters.deleteSavedView}</span>
      </button>
    </div>

    <FilterLabeledSelect
      label={UI_COPY.tasks.filters.statusLabel}
      ariaLabel={UI_COPY.tasks.filters.statusAria}
      bind:value={statusFilter}
      options={statusOptions}
    />
    <FilterLabeledSelect
      label={UI_COPY.tasks.filters.priorityLabel}
      ariaLabel={UI_COPY.tasks.filters.priorityAria}
      bind:value={priorityFilter}
      options={priorityOptions}
    />
    <FilterLabeledSelect
      label={UI_COPY.tasks.filters.ownerLabel}
      ariaLabel={UI_COPY.tasks.filters.ownerAria}
      bind:value={ownerFilter}
      options={ownerOptions}
    />
    <FilterLabeledSelect
      label={UI_COPY.tasks.filters.tagsLabel}
      ariaLabel={UI_COPY.tasks.filters.tagsAria}
      bind:value={tagAddDraft}
      options={tagAddOptions}
      onSelect={handleTagSelect}
    />

    {#if tagFilters.length > 0}
      <div class="filter-applied-tags-row">
        <div
          class="filter-applied-tags"
          role="group"
          aria-label={UI_COPY.tasks.filters.activeTagsAria}
        >
          {#each tagFilters as tag (tag)}
            <span class="filter-tag-pill">
              <span class="filter-tag-pill-text">{tag}</span>
              <button
                type="button"
                class="filter-tag-pill-remove"
                aria-label={`${UI_COPY.tasks.filters.removeTagAriaPrefix}${tag}`}
                title={`${UI_COPY.tasks.filters.removeTagTitlePrefix}${tag}${UI_COPY.tasks.filters.removeTagTitleSuffix}`}
                on:click|preventDefault={() => removeTagFilter(tag)}
              >
                ×
              </button>
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <FilterDueDateRange
      bind:filterFrom
      bind:filterTo
      dateFormat={DATE_FORMAT}
      pickerI18n={PICKER_I18N}
    />

    <FilterSortRow bind:sortKey bind:sortAscending />

    <ClearFiltersButton {hasActiveFilters} {clearAllFilters} />
  </div>
</div>
