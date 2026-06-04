import { describe, expect, it, vi } from 'vitest'
import { runBoundedDeletes } from '../../src/lib/app/task-app/bulkDelete'

describe('runBoundedDeletes', () => {
  it('collects deleted ids when all deletions succeed', async () => {
    const deleteOne = vi.fn(async (_id: string) => {})
    const onError = vi.fn()
    const ids = ['a', 'b', 'c']

    const result = await runBoundedDeletes(ids, deleteOne, onError, 2)

    expect(result.failed).toBe(0)
    expect(result.deletedIds.sort()).toEqual(ids.sort())
    expect(onError).not.toHaveBeenCalled()
  })

  it('continues processing and reports failures', async () => {
    const deleteOne = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('boom')
    })
    const onError = vi.fn()
    const result = await runBoundedDeletes(['a', 'b', 'c'], deleteOne, onError, 2)

    expect(result.failed).toBe(1)
    expect(result.deletedIds.sort()).toEqual(['a', 'c'])
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
