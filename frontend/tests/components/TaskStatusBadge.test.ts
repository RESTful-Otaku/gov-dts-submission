import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import TaskStatusBadge from '../../src/components/tasks/TaskStatusBadge.svelte'

describe('TaskStatusBadge', () => {
  it('renders label and status class', () => {
    const { container, getByText } = render(TaskStatusBadge, {
      props: { status: 'in_progress', label: 'In progress' },
    })

    expect(getByText('In progress')).toBeVisible()
    expect(container.querySelector('.status.status-in_progress')).toBeTruthy()
  })
})

