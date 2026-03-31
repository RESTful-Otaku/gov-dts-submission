import type { Meta, StoryObj } from '@storybook/svelte'

import TasksKanbanView from '../components/tasks/TasksKanbanView.svelte'
import { KANBAN_COLUMNS } from '../lib/app/constants'
import type { Task, TaskStatus } from '../lib/api'

const visibleTasks: Task[] = [
  {
    id: 't1',
    title: 'Review case bundle',
    description: 'Read the bundle and extract key issues.',
    status: 'todo',
    priority: 'high',
    owner: 'Sarah Chen',
    tags: ['summary'],
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Draft decision letter',
    description: null,
    status: 'in_progress',
    priority: 'urgent',
    owner: 'James Wilson',
    tags: ['letter'],
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't3',
    title: 'Prepare hearing notes',
    description: null,
    status: 'done',
    priority: 'normal',
    owner: '',
    tags: ['checklist'],
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const tasksForColumn = (status: TaskStatus) => visibleTasks.filter((t) => t.status === status)

const meta = {
  title: 'Tasks/Views/TasksKanbanView',
  component: TasksKanbanView,
  args: {
    visibleTasks,
    KANBAN_COLUMNS,
    KANBAN_FLIP_MS: 150,
    tasksForColumn,
    handleKanbanConsider: () => {},
    handleKanbanFinalize: () => {},
    filterByTag: () => {},
    openEditModal: () => {},
    handleDeleteTask: () => {},
    statusLabel: (s: any) => s,
    priorityLabel: (p: any) => p,
    formatDate: (v: any) => v,
    isNarrow: false,
  },
} satisfies Meta<typeof TasksKanbanView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

