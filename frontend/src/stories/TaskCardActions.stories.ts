import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import TaskCardActions from '../components/tasks/TaskCardActions.svelte'

const meta = {
  title: 'Tasks/TaskCardActions',
  component: TaskCardActions,
  args: {
    stopPropagation: false,
    onEdit: fn(),
    onDelete: fn(),
    deleteTitle: 'Delete task',
  },
} satisfies Meta<typeof TaskCardActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const StopPropagation: Story = { args: { stopPropagation: true } }
