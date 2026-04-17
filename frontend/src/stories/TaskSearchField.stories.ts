import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import TaskSearchField from '../components/tasks/TaskSearchField.svelte'

const meta = {
  title: 'Tasks/TaskSearchField',
  component: TaskSearchField,
  args: {
    searchTerm: '',
    searchInput: null,
    placeholder: 'Title, description...',
    title: 'Search tasks',
    expandedMobile: false,
    mobileInline: false,
    onInput: fn(),
  },
} satisfies Meta<typeof TaskSearchField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ExpandedMobile: Story = { args: { expandedMobile: true, placeholder: 'Search…' } }
export const MobileInline: Story = {
  args: { mobileInline: true, expandedMobile: false, placeholder: 'Search…' },
}
