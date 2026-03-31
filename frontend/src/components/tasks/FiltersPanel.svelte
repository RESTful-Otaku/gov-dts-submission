<script lang="ts">
  import { cubicOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
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

  export let DATE_FORMAT: string
  export let PICKER_I18N: i18nType

  export let clearAllFilters: () => void

  let tagAddDraft = ''

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

  $: statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ]
  $: priorityOptions = [
    { value: 'all', label: 'All priorities' },
    ...PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ]
  $: ownerOptions = [
    { value: '', label: 'All owners' },
    ...uniqueOwners.map((o) => ({ value: o, label: o })),
  ]
  $: tagAddOptions = [
    { value: '', label: 'Add a tag…' },
    ...allTags.filter((t) => !tagAlreadySelected(t)).map((t) => ({ value: t, label: t })),
  ]
</script>

<div
  id="advanced-filters"
  class="filters-panel"
  role="region"
  aria-label="Advanced filters and sorting"
  transition:slide={{ duration: 220, easing: cubicOut, axis: 'y' }}
>
  <div class="filter-controls">
    <FilterLabeledSelect
      label="Status"
      ariaLabel="Filter by status"
      bind:value={statusFilter}
      options={statusOptions}
    />
    <FilterLabeledSelect
      label="Priority"
      ariaLabel="Filter by priority"
      bind:value={priorityFilter}
      options={priorityOptions}
    />
    <FilterLabeledSelect
      label="Owner"
      ariaLabel="Filter by owner"
      bind:value={ownerFilter}
      options={ownerOptions}
    />
    <FilterLabeledSelect
      label="Tags"
      ariaLabel="Add tag to filter"
      bind:value={tagAddDraft}
      options={tagAddOptions}
      onSelect={handleTagSelect}
    />

    {#if tagFilters.length > 0}
      <div class="filter-applied-tags-row">
        <div
          class="filter-applied-tags"
          role="group"
          aria-label="Active tag filters. Remove a tag to stop filtering by it."
        >
          {#each tagFilters as tag (tag)}
            <span class="filter-tag-pill">
              <span class="filter-tag-pill-text">{tag}</span>
              <button
                type="button"
                class="filter-tag-pill-remove"
                aria-label={`Remove tag filter ${tag}`}
                title={`Remove “${tag}” from filters`}
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
