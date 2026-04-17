import type { Meta, StoryObj } from '@storybook/svelte'

import TasksListView from '../components/tasks/TasksListView.svelte'
import { PICKER_I18N } from '../lib/app/constants'
import { setIndeterminate } from '../lib/dom/setIndeterminate'
import type { Task } from '../lib/api'
import { STATUS_OPTIONS } from '../lib/tasks/taskMeta'

const visibleTasks: Task[] = [
  {
    id: 't1',
    title: 'Review case bundle',
    description: null,
    status: 'todo',
    priority: 'high',
    owner: 'Sarah Chen',
    tags: ['evidence', 'listing'],
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
  title: 'Tasks/Views/TasksListView',
  component: TasksListView,
  args: {
    isNarrow: false,
    visibleTasks,
    listTasksDisplay: visibleTasks,
    selectedTaskIds: new Set(['t1']),
    isSelectAllIndeterminate: false,
    allVisibleTasksSelected: false,
    totalListPages: 1,
    LIST_PAGE_SIZES: [10, 20, 30],
    STATUS_OPTIONS: [...STATUS_OPTIONS],
    listPage: 1,
    listPageSize: 20,
    quickAddTitle: '',
    quickAddDateTimeStr: '',
    quickAddSubmitting: false,
    DATETIME_FORMAT: 'dd-mm-yyyy HH:ii P',
    PICKER_I18N,
    setIndeterminate,
    handleQuickAdd: () => {},
    toggleTaskSelection: () => {},
    selectAllInList: () => {},
    selectAllInListView: () => {},
    clearListSelection: () => {},
    bulkSetStatus: () => {},
    openBulkDeleteModal: () => {},
    openEditModal: () => {},
    handleDeleteTask: () => {},
    filterByTag: () => {},
    priorityLabel: (p: any) => p,
    statusLabel: (s: any) => s,
    formatDate: (v: any) => v,
    sortKey: 'due',
    sortAscending: true,
    onSortColumn: () => {},
  },
} satisfies Meta<typeof TasksListView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: { visibleTasks: [], listTasksDisplay: [], selectedTaskIds: new Set() },
}

