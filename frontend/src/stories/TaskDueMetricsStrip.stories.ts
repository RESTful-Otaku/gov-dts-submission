import type { Meta, StoryObj } from '@storybook/svelte'

import TaskDueMetricsStrip from '../components/tasks/TaskDueMetricsStrip.svelte'

const meta = {
  title: 'Tasks/TaskDueMetricsStrip',
  component: TaskDueMetricsStrip,
  args: {
    overdueCount: 2,
    dueTodayCount: 1,
    dueThisWeekCount: 4,
  },
} satisfies Meta<typeof TaskDueMetricsStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
