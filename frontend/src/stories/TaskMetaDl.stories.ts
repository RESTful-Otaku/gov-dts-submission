import type { Meta, StoryObj } from '@storybook/svelte'

import TaskMetaDl from '../components/tasks/TaskMetaDl.svelte'

const meta = {
  title: 'Tasks/TaskMetaDl',
  component: TaskMetaDl,
  args: {
    rows: [
      { term: 'Due', description: '27-03-2026' },
      { term: 'Created', description: '01-03-2026' },
    ],
  },
} satisfies Meta<typeof TaskMetaDl>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
