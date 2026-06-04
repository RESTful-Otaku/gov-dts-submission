import type { Meta, StoryObj } from '@storybook/svelte'

import ListPagination from '../components/tasks/ListPagination.svelte'

const meta = {
  title: 'Tasks/ListPagination',
  component: ListPagination,
  args: {
    listPage: 1,
    listPageSize: 10,
    totalListPages: 5,
    visibleCount: 42,
    LIST_PAGE_SIZES: [10, 20, 30],
  },
} satisfies Meta<typeof ListPagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
