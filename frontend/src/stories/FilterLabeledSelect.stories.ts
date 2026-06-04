import type { Meta, StoryObj } from '@storybook/svelte'

import FilterLabeledSelect from '../components/filters/FilterLabeledSelect.svelte'

const meta = {
  title: 'Filters/FilterLabeledSelect',
  component: FilterLabeledSelect,
  args: {
    label: 'Status',
    ariaLabel: 'Filter by status',
    value: 'all',
    options: [
      { value: 'all', label: 'All statuses' },
      { value: 'todo', label: 'To do' },
    ],
  },
} satisfies Meta<typeof FilterLabeledSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
