import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import ViewModeToggle from '../components/tasks/ViewModeToggle.svelte'

const meta = {
  title: 'Tasks/ViewModeToggle',
  component: ViewModeToggle,
  args: {
    viewMode: 'cards',
    onSetViewMode: fn(),
  },
} satisfies Meta<typeof ViewModeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Cards: Story = { args: { viewMode: 'cards' } }
export const List: Story = { args: { viewMode: 'list' } }
