import { describe, expect, it, vi } from 'vitest'
import { handleGlobalKeydown } from '../../src/lib/app/globalShortcuts'

function keyEvt(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
}

function baseCtx(over: Partial<Parameters<typeof handleGlobalKeydown>[1]> = {}) {
  return {
    tourRunning: false,
    helpModalOpen: false,
    createModalOpen: false,
    editModalTaskId: null as string | null,
    deleteModalTaskIds: null as string[] | null,
    searchInput: null as HTMLInputElement | null,
    stopTour: vi.fn(),
    closeHelp: vi.fn(),
    closeCreateModal: vi.fn(),
    closeEditModal: vi.fn(),
    closeDeleteModal: vi.fn(),
    openCreateModal: vi.fn(),
    setViewMode: vi.fn(),
    ...over,
  }
}

describe('globalShortcuts', () => {
  it('closes help modal on Escape before other modals', () => {
    const closeHelp = vi.fn()
    const closeCreate = vi.fn()
    const ev = keyEvt('Escape')
    handleGlobalKeydown(
      ev,
      baseCtx({
        helpModalOpen: true,
        createModalOpen: true,
        closeHelp,
        closeCreateModal: closeCreate,
      }),
    )
    expect(closeHelp).toHaveBeenCalled()
    expect(closeCreate).not.toHaveBeenCalled()
  })

  it('stops guided tour on Escape when no modal is open', () => {
    const stopTour = vi.fn()
    const ev = keyEvt('Escape')
    handleGlobalKeydown(ev, baseCtx({ tourRunning: true, stopTour }))
    expect(stopTour).toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('closes modals on Escape in order when help is closed', () => {
    const closeCreate = vi.fn()
    const closeEdit = vi.fn()
    const closeDelete = vi.fn()
    const ev = keyEvt('Escape')
    handleGlobalKeydown(
      ev,
      baseCtx({
        createModalOpen: true,
        editModalTaskId: 'x',
        deleteModalTaskIds: ['a'],
        closeCreateModal: closeCreate,
        closeEditModal: closeEdit,
        closeDeleteModal: closeDelete,
      }),
    )
    expect(closeCreate).toHaveBeenCalled()
    expect(closeEdit).not.toHaveBeenCalled()
  })

  it('focuses search on /', () => {
    const input = document.createElement('input')
    const focus = vi.spyOn(input, 'focus')
    const ev = keyEvt('/')
    handleGlobalKeydown(ev, baseCtx({ searchInput: input }))
    expect(focus).toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ignores letter keys when focus is in an input', () => {
    const input = document.createElement('input')
    const openCreate = vi.fn()
    const ev = keyEvt('c')
    vi.spyOn(ev, 'composedPath').mockReturnValue([input])
    Object.defineProperty(ev, 'target', { value: input, configurable: true })
    handleGlobalKeydown(ev, baseCtx({ openCreateModal: openCreate }))
    expect(openCreate).not.toHaveBeenCalled()
  })
})
