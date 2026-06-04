import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import FiltersPanel from '../components/tasks/FiltersPanel.svelte'
import { PICKER_I18N } from '../lib/app/constants'

const meta = {
  title: 'Tasks/FiltersPanel',
  component: FiltersPanel,
  args: {
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
    PICKER_I18N,
    clearAllFilters: fn(),
  },
} satisfies Meta<typeof FiltersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ActiveClear: Story = { args: { hasActiveFilters: true } }
export const WithAppliedTags: Story = {
  args: { tagFilters: ['evidence', 'hearing'], hasActiveFilters: true, allTags: ['evidence', 'hearing', 'bundle'] },
}
