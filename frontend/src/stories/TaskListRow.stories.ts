import type { Meta, StoryObj } from '@storybook/svelte'
import { fn } from 'storybook/test'

import TaskListRow from '../components/tasks/TaskListRow.svelte'

const meta = {
  title: 'Tasks/TaskListRow',
  component: TaskListRow,
  args: {
    taskItem: {
      id: 't1',
      title: 'Review case bundle',
      description: null,
      status: 'todo',
      priority: 'high',
      owner: 'Sarah Chen',
      tags: ['evidence'],
      dueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    selected: false,
    toggleTaskSelection: fn(),
    openEditModal: fn(),
    handleDeleteTask: fn(),
    filterByTag: fn(),
    priorityLabel: (p: string) => p,
    statusLabel: (s: string) => s,
    formatDate: (v: string) => v,
  },
} satisfies Meta<typeof TaskListRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
