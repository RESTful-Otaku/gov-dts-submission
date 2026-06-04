import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import EditTaskModal from '../../src/components/modals/EditTaskModal.svelte'

describe('EditTaskModal', () => {
  it('renders and closes on close/escape/backdrop', () => {
    const closeEditModal = vi.fn()
    const handleEditTask = vi.fn()
    const handleModalBackdropClick = vi.fn()
    const modalContentTransition = () => ({ duration: 0 })

    const { getByRole, getByLabelText, container } = render(EditTaskModal, {
      props: {
        isNarrow: false,
        modalContentTransition,
        editTitle: 'Task',
        editDescription: '',
        editStatus: 'todo',
        editPriority: 'normal',
        editTagsInput: '',
        editModalFirstInput: null,
        closeEditModal,
        handleEditTask,
        handleModalBackdropClick,
      },
    })

    expect(getByRole('dialog')).toBeVisible()
    expect(container.querySelector('h2#edit-modal-title')?.textContent).toContain('Edit task')

    fireEvent.click(getByLabelText('Close'))
    expect(closeEditModal).toHaveBeenCalledTimes(1)

    const backdropEl = container.querySelector('.modal-backdrop') as HTMLElement
    expect(backdropEl).toBeTruthy()
    fireEvent.click(backdropEl)
    expect(handleModalBackdropClick).toHaveBeenCalled()

    fireEvent.keyDown(backdropEl, { key: 'Escape' })
    expect(closeEditModal).toHaveBeenCalledTimes(2)
  })
})

