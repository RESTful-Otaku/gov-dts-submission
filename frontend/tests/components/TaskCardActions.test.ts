import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import TaskCardActions from '../../src/components/tasks/TaskCardActions.svelte'

describe('TaskCardActions', () => {
  it('calls edit and delete', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const { getByRole } = render(TaskCardActions, {
      props: {
        stopPropagation: false,
        onEdit,
        onDelete,
        deleteTitle: 'Delete task X',
      },
    })
    await user.click(getByRole('button', { name: 'Edit' }))
    await user.click(getByRole('button', { name: 'Delete' }))
    expect(onEdit).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })
})
