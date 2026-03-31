import type { Meta, StoryObj } from '@storybook/svelte'

import TaskPriorityBadge from '../components/tasks/TaskPriorityBadge.svelte'
import TaskStatusBadge from '../components/tasks/TaskStatusBadge.svelte'

export default {
  title: 'Tasks/Micro/Badges',
} satisfies Meta<any>

type PriorityStory = StoryObj<any>
export const Priority: PriorityStory = {
  render: (args: any) => ({
    Component: TaskPriorityBadge,
    props: args,
  }),
  args: { priority: 'high', label: 'High' },
}

type StatusStory = StoryObj<any>
export const Status: StatusStory = {
  render: (args: any) => ({
    Component: TaskStatusBadge,
    props: args,
  }),
  args: { status: "in_progress", label: "In progress" },
}

