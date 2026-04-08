import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import type { Task } from '../../src/lib/api'
import TasksListView from '../../src/components/tasks/TasksListView.svelte'
import { en as pickerEn } from 'svelty-picker/i18n'
import { STATUS_OPTIONS } from '../../src/lib/tasks/taskMeta'

function setIndeterminate(node: HTMLInputElement, value: boolean) {
  node.indeterminate = value
  return {
    update(next: boolean) {
      node.indeterminate = next
    },
  }
}

describe('TasksListView', () => {
  it('renders quick-add, table rows, and actions', async () => {
    const user = userEvent.setup()

    const handleQuickAdd = vi.fn()
    const toggleTaskSelection = vi.fn()
    const selectAllInList = vi.fn()
    const selectAllInListView = vi.fn()
    const clearListSelection = vi.fn()
    const bulkSetStatus = vi.fn()
    const openBulkDeleteModal = vi.fn()
    const openEditModal = vi.fn()
    const handleDeleteTask = vi.fn()
    const filterByTag = vi.fn()
    const onSortColumn = vi.fn()

    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Review case bundle',
        description: null,
        status: 'todo',
        priority: 'normal',
        owner: 'Sarah Chen',
        tags: ['evidence'],
        dueAt: new Date(2026, 2, 27, 10, 0, 0, 0).toISOString(),
        createdAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
        updatedAt: new Date(2026, 2, 1, 10, 0, 0, 0).toISOString(),
      },
    ]

    const selectedTaskIds = new Set<string>(['t1'])

    const { getByRole, getByText } = render(TasksListView, {
      props: {
        isNarrow: false,
        visibleTasks: tasks,
        listTasksDisplay: tasks,
        selectedTaskIds,
        isSelectAllIndeterminate: false,
        allVisibleTasksSelected: true,
        totalListPages: 1,
        LIST_PAGE_SIZES: [10, 20, 30],
        STATUS_OPTIONS: STATUS_OPTIONS as any,
        listPage: 1,
        listPageSize: 20,
        quickAddTitle: '',
        quickAddDateTimeStr: '',
        quickAddSubmitting: false,
        DATETIME_FORMAT: 'dd-mm-yyyy HH:ii P',
        PICKER_I18N: { ...pickerEn, weekStart: 1 },
        setIndeterminate,
        handleQuickAdd,
        toggleTaskSelection,
        selectAllInList,
        selectAllInListView,
        clearListSelection,
        bulkSetStatus,
        openBulkDeleteModal,
        openEditModal,
        handleDeleteTask,
        filterByTag,
        priorityLabel: (p) => p,
        statusLabel: (s) => s,
        formatDate: (v) => v,
        sortKey: 'due' as const,
        sortAscending: true,
        onSortColumn,
      },
    })

    expect(getByRole('region', { name: 'Tasks in list view' })).toBeVisible()
    expect(getByText('Review case bundle')).toBeVisible()
    expect(getByRole('button', { name: 'Edit' })).toBeVisible()
    expect(getByRole('button', { name: 'Delete' })).toBeVisible()

    await user.click(getByRole('button', { name: 'Edit' }))
    expect(openEditModal).toHaveBeenCalledWith(tasks[0])

    await user.click(getByRole('button', { name: 'Delete' }))
    expect(handleDeleteTask).toHaveBeenCalledWith('t1')

    await user.click(getByText('Delete selected'))
    expect(openBulkDeleteModal).toHaveBeenCalledTimes(1)

    await user.click(getByText('evidence'))
    expect(filterByTag).toHaveBeenCalledWith('evidence')

    await user.click(getByRole('button', { name: /Title/ }))
    expect(onSortColumn).toHaveBeenCalledWith('title')
  })
})

