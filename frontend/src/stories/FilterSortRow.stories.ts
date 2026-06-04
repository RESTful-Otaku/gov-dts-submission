import type { Meta, StoryObj } from '@storybook/svelte'

import FilterSortRow from '../components/filters/FilterSortRow.svelte'

const meta = {
  title: 'Filters/FilterSortRow',
  component: FilterSortRow,
  args: {
    sortKey: 'due',
    sortAscending: true,
  },
} satisfies Meta<typeof FilterSortRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
