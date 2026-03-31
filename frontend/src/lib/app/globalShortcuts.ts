import type { ViewMode } from './types'

export type GlobalKeydownContext = {
  tourRunning: boolean
  helpModalOpen: boolean
  createModalOpen: boolean
  editModalTaskId: string | null
  deleteModalTaskIds: string[] | null
  searchInput: HTMLInputElement | null
  stopTour: () => void
  closeHelp: () => void
  closeCreateModal: () => void
  closeEditModal: () => void
  closeDeleteModal: () => void
  openCreateModal: () => void
  setViewMode: (mode: ViewMode) => void
}

export function handleGlobalKeydown(event: KeyboardEvent, ctx: GlobalKeydownContext): void {
  const target = event.target as HTMLElement | null
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    if (event.key !== 'Escape') return
  }

  if (event.key === 'Escape') {
    if (ctx.helpModalOpen) {
      event.preventDefault()
      ctx.closeHelp()
      return
    }
    if (ctx.createModalOpen) {
      event.preventDefault()
      ctx.closeCreateModal()
      return
    }
    if (ctx.editModalTaskId !== null) {
      event.preventDefault()
      ctx.closeEditModal()
      return
    }
    if (ctx.deleteModalTaskIds !== null) {
      event.preventDefault()
      ctx.closeDeleteModal()
      return
    }
    if (ctx.tourRunning) {
      event.preventDefault()
      ctx.stopTour()
      return
    }
  }

  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    ctx.searchInput?.focus()
    return
  }

  if (event.key === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    ctx.openCreateModal()
    return
  }

  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    if (event.key === '1') {
      ctx.setViewMode('cards')
    } else if (event.key === '2') {
      ctx.setViewMode('list')
    } else if (event.key === '3') {
      ctx.setViewMode('kanban')
    }
  }
}
