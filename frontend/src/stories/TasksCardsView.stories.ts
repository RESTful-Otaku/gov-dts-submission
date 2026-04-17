import type { Meta, StoryObj } from '@storybook/svelte'

import TasksCardsView from '../components/tasks/TasksCardsView.svelte'
import type { Task } from '../lib/api'

const demoTasks: Task[] = [
  {
    id: 't1',
    title: 'Review case bundle',
    description: 'Read the bundle and extract key issues.',
    status: 'todo',
    priority: 'high',
    owner: 'Sarah Chen',
    tags: ['evidence', 'summary'],
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Prepare hearing notes',
    description: null,
    status: 'done',
    priority: 'normal',
    owner: '',
    tags: ['checklist'],
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const meta = {
  title: 'Tasks/Views/TasksCardsView',
  component: TasksCardsView,
  args: {
    isNarrow: false,
    visibleTasks: demoTasks,
    priorityLabel: (p: any) => p,
    statusLabel: (s: any) => s,
    formatDate: (v: any) => v,
    openEditModal: () => {},
    handleDeleteTask: () => {},
    filterByTag: () => {},
  },
} satisfies Meta<typeof TasksCardsView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { visibleTasks: [] } }
export const MobileSwipe: Story = { args: { isNarrow: true } }

