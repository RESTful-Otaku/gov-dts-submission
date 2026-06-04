import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import ClearFiltersButton from '../components/filters/ClearFiltersButton.svelte'

const meta = {
  title: 'Filters/ClearFiltersButton',
  component: ClearFiltersButton,
  args: {
    hasActiveFilters: true,
    clearAllFilters: fn(),
  },
} satisfies Meta<typeof ClearFiltersButton>

export default meta
type Story = StoryObj<typeof meta>

export const Visible: Story = {}
export const Hidden: Story = { args: { hasActiveFilters: false } }
