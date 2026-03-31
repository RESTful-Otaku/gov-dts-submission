import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/svelte'

import TagChips from '../../src/components/tasks/TagChips.svelte'
import TagChipsHarness from '../fixtures/TagChipsHarness.svelte'

describe('TagChips', () => {
  it('renders nothing when tags empty', () => {
    const { container } = render(TagChips, {
      props: { tags: [], onTagClick: vi.fn() },
    })

    expect(container.querySelector('.tag-chips')).toBeNull()
  })

  it('calls onTagClick with clicked tag', async () => {
    const user = userEvent.setup()
    const onTagClick = vi.fn()

    const { getByRole } = render(TagChips, {
      props: { tags: ['alpha', 'beta'], onTagClick, wrapper: 'div' },
    })

    await user.click(getByRole('button', { name: 'beta' }))
    expect(onTagClick).toHaveBeenCalledWith('beta')
  })

  it('can stop propagation to outer click handler', async () => {
    const user = userEvent.setup()
    const onTagClick = vi.fn()
    const onOuterClick = vi.fn()

    const { getByRole } = render(TagChipsHarness, {
      props: { tags: ['evidence'], stopPropagation: true, onTagClick, onOuterClick },
    })

    await user.click(getByRole('button', { name: 'evidence' }))
    expect(onTagClick).toHaveBeenCalledWith('evidence')
    expect(onOuterClick).not.toHaveBeenCalled()
  })
})

