import type { Meta, StoryObj } from '@storybook/svelte'

import TaskStatusSelect from '../components/forms/TaskStatusSelect.svelte'

const meta = {
  title: 'Forms/TaskStatusSelect',
  component: TaskStatusSelect,
  args: {
    id: 'story-status',
    value: 'todo',
  },
} satisfies Meta<typeof TaskStatusSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
