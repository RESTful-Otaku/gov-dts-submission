import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/svelte'

import TaskMetaDl from '../../src/components/tasks/TaskMetaDl.svelte'

describe('TaskMetaDl', () => {
  it('renders meta rows', () => {
    const { getByText } = render(TaskMetaDl, {
      props: {
        rows: [
          { term: 'Due', description: '1 Jan' },
          { term: 'Created', description: '2 Jan' },
        ],
      },
    })
    expect(getByText('Due')).toBeVisible()
    expect(getByText('1 Jan')).toBeVisible()
  })
})
