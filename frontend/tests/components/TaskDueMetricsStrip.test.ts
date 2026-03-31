import { describe, expect, it } from 'vitest'
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
})
