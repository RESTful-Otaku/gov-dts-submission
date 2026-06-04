import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

import { en as pickerEn } from 'svelty-picker/i18n'

import CreateTaskModal from '../../src/components/modals/CreateTaskModal.svelte'

describe('CreateTaskModal', () => {
  it('renders and closes on close button / escape / backdrop click', () => {
    const closeCreateModal = vi.fn()
    const handleCreateTask = vi.fn()
    const handleModalBackdropClick = vi.fn()

    const modalContentTransition = () => ({ duration: 0 })

    const { getByRole, getByLabelText, container } = render(CreateTaskModal, {
      props: {
        isNarrow: false,
        modalContentTransition,
        title: 'Test',
        description: '',
        status: 'todo',
        priority: 'normal',
        owner: '',
        tagsInput: '',
        dueDateTimeStr: '',
        modalFirstInput: null,
        DATETIME_FORMAT: 'dd-mm-yyyy HH:ii P',
        PICKER_I18N: { ...pickerEn, weekStart: 1 },
        closeCreateModal,
        handleCreateTask,
        handleModalBackdropClick,
      },
    })

    expect(getByRole('dialog')).toBeVisible()
    expect(container.querySelector('h2#modal-title')?.textContent).toContain('Create a new task')

    const closeBtn = getByLabelText('Close')
    fireEvent.click(closeBtn)
    expect(closeCreateModal).toHaveBeenCalledTimes(1)

    // Backdrop click (target the backdrop element specifically)
    const backdropEl = container.querySelector('.modal-backdrop') as HTMLElement
    expect(backdropEl).toBeTruthy()
    fireEvent.click(backdropEl)
    expect(handleModalBackdropClick).toHaveBeenCalled()

    // Escape key closes
    fireEvent.keyDown(backdropEl, { key: 'Escape' })
    expect(closeCreateModal).toHaveBeenCalledTimes(2)
  })
})

