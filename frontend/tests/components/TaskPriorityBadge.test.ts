import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import TaskPriorityBadge from '../../src/components/tasks/TaskPriorityBadge.svelte'

describe('TaskPriorityBadge', () => {
  it('renders label and priority class', () => {
    const { container, getByText } = render(TaskPriorityBadge, {
      props: { priority: 'urgent', label: 'Urgent' },
    })

    expect(getByText('Urgent')).toBeVisible()
    expect(container.querySelector('.priority-badge.priority-urgent')).toBeTruthy()
  })

  it('falls back to normal class when priority undefined', () => {
    const { container } = render(TaskPriorityBadge, {
      props: { priority: undefined, label: 'Normal' },
    })

    expect(container.querySelector('.priority-badge.priority-normal')).toBeTruthy()
  })
})

