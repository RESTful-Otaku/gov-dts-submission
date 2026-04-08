import type { Task, TaskPriority, TaskStatus } from '../api'
import type { SortKey } from '../app/types'
import { PRIORITY_ORDER } from './taskMeta'

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 1,
  in_progress: 2,
  done: 3,
}

function tagsSortKey(task: Task): string {
  const tags = task.tags ?? []
  if (tags.length === 0) return ''
  return [...tags].map((t) => t.toLocaleLowerCase()).sort().join('\u0001')
}

export function getSortedTasks(source: Task[], key: SortKey, ascending: boolean): Task[] {
  if (source.length < 2) return [...source]
  const dir = ascending ? 1 : -1

  if (key === 'title') {
    return source
      .map((task, index) => ({ task, index, title: task.title.toLocaleLowerCase() }))
      .sort((a, b) => {
        if (a.title < b.title) return -1 * dir
        if (a.title > b.title) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  if (key === 'priority') {
    return source
      .map((task, index) => ({
        task,
        index,
        priority: PRIORITY_ORDER[(task.priority as TaskPriority) ?? 'normal'],
      }))
      .sort((a, b) => {
        if (a.priority < b.priority) return -1 * dir
        if (a.priority > b.priority) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  if (key === 'owner') {
    return source
      .map((task, index) => ({
        task,
        index,
        owner: (task.owner ?? '').toLocaleLowerCase(),
      }))
      .sort((a, b) => {
        if (a.owner < b.owner) return -1 * dir
        if (a.owner > b.owner) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  if (key === 'status') {
    return source
      .map((task, index) => ({
        task,
        index,
        rank: STATUS_ORDER[(task.status as TaskStatus) ?? 'todo'] ?? 99,
      }))
      .sort((a, b) => {
        if (a.rank < b.rank) return -1 * dir
        if (a.rank > b.rank) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  if (key === 'tags') {
    return source
      .map((task, index) => ({ task, index, key: tagsSortKey(task) }))
      .sort((a, b) => {
        if (a.key < b.key) return -1 * dir
        if (a.key > b.key) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  if (key === 'created') {
    return source
      .map((task, index) => ({ task, index, ms: new Date(task.createdAt).getTime() }))
      .sort((a, b) => {
        if (a.ms < b.ms) return -1 * dir
        if (a.ms > b.ms) return 1 * dir
        return a.index - b.index
      })
      .map((entry) => entry.task)
  }

  return source
    .map((task, index) => ({ task, index, dueMs: new Date(task.dueAt).getTime() }))
    .sort((a, b) => {
      if (a.dueMs < b.dueMs) return -1 * dir
      if (a.dueMs > b.dueMs) return 1 * dir
      return a.index - b.index
    })
    .map((entry) => entry.task)
}

