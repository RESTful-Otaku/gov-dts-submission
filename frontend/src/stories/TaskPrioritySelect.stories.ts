import type { Meta, StoryObj } from '@storybook/svelte'

import TaskPrioritySelect from '../components/forms/TaskPrioritySelect.svelte'

const meta = {
  title: 'Forms/TaskPrioritySelect',
  component: TaskPrioritySelect,
  args: {
    id: 'story-priority',
    value: 'normal',
  },
} satisfies Meta<typeof TaskPrioritySelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
