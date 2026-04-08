import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import TaskDueMetricsStrip from '../../src/components/tasks/TaskDueMetricsStrip.svelte'

describe('TaskDueMetricsStrip', () => {
  it('renders counts', () => {
    const { getByRole, getByText } = render(TaskDueMetricsStrip, {
      props: { overdueCount: 2, dueTodayCount: 1, dueThisWeekCount: 3 },
    })
    const region = getByRole('status', { name: 'Task due date summary' })
    expect(region).toBeVisible()
    expect(region.textContent).toContain('2')
    expect(region.textContent).toContain('overdue')
    expect(region.textContent).toContain('due today')
    expect(region.textContent).toContain('due this week')
  })

  it('calls focus-today action', async () => {
    const user = userEvent.setup()
    const onFocusToday = vi.fn()
    const { getByRole } = render(TaskDueMetricsStrip, {
      props: { overdueCount: 2, dueTodayCount: 1, dueThisWeekCount: 3, onFocusToday },
    })
    await user.click(getByRole('button', { name: 'Filter tasks due today' }))
    expect(onFocusToday).toHaveBeenCalledTimes(1)
  })
})
