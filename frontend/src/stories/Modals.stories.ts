import type { Meta, StoryObj } from '@storybook/svelte'
import { en as pickerEn } from 'svelty-picker/i18n'

import CreateTaskModal from '../components/modals/CreateTaskModal.svelte'
import DeleteTasksModal from '../components/modals/DeleteTasksModal.svelte'
import EditTaskModal from '../components/modals/EditTaskModal.svelte'

const modalContentTransition = () => ({ duration: 0 })

export default {
  title: 'Modals',
  tags: ['autodocs'],
} satisfies Meta<any>

type CreateStory = StoryObj<any>
export const CreateTaskModalStory: CreateStory = {
  name: 'CreateTaskModal',
  render: (args: any) => ({ Component: CreateTaskModal, props: args }),
  args: {
    isNarrow: false,
    modalContentTransition,
    title: 'New task',
    description: '',
    status: 'todo',
    priority: 'normal',
    owner: '',
    tagsInput: '',
    dueDateTimeStr: '01-01-2030 11:00 AM',
    modalFirstInput: null,
    DATETIME_FORMAT: 'dd-mm-yyyy HH:ii P',
    PICKER_I18N: { ...pickerEn, weekStart: 1 },
    closeCreateModal: () => {},
    handleCreateTask: () => {},
    handleModalBackdropClick: () => {},
  },
}

type EditStory = StoryObj<any>
export const EditTaskModalStory: EditStory = {
  name: 'EditTaskModal',
  render: (args: any) => ({ Component: EditTaskModal, props: args }),
  args: {
    isNarrow: false,
    modalContentTransition,
    editTitle: 'Review case bundle',
    editDescription: '',
    editStatus: 'todo',
    editPriority: 'high',
    editTagsInput: 'evidence',
    editModalFirstInput: null,
    closeEditModal: () => {},
    handleEditTask: () => {},
    handleModalBackdropClick: () => {},
  },
}

type DeleteStory = StoryObj<any>
export const DeleteTasksModalStory: DeleteStory = {
  name: 'DeleteTasksModal',
  render: (args: any) => ({ Component: DeleteTasksModal, props: args }),
  args: {
    tasks: [
      {
        id: 't1',
        title: 'Review case bundle',
        description: null,
        status: 'todo',
        priority: 'high',
        owner: 'Sarah Chen',
        tags: ['evidence'],
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    deleteModalTaskIds: ['t1'],
    handleModalBackdropClick: () => {},
    closeDeleteModal: () => {},
    performDeleteTask: () => {},
  },
}

