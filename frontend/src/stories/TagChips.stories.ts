import type { Meta, StoryObj } from '@storybook/svelte'

import TagChips from '../components/tasks/TagChips.svelte'

const meta = {
  title: 'Tasks/Micro/TagChips',
  component: TagChips,
  args: {
    tags: ['evidence', 'summary', 'urgent'],
    onTagClick: () => {},
    wrapper: 'div',
    stopPropagation: false,
  },
} satisfies Meta<typeof TagChips>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const InlineWrapper: Story = { args: { wrapper: 'span' } }
export const NoTags: Story = { args: { tags: [] } }

