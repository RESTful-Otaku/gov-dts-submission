import { describe, expect, it, vi } from 'vitest'
import { dueAtIsoFromPicker, parseTagsInput, validateCreateTaskForm } from '../../src/lib/tasks/taskForm'

describe('taskForm', () => {
  it('parseTagsInput splits and trims', () => {
    expect(parseTagsInput('a, b ; c')).toEqual(['a', 'b', 'c'])
    expect(parseTagsInput('  ')).toEqual([])
  })

  it('dueAtIsoFromPicker delegates to parser', () => {
    const parse = vi.fn().mockReturnValue('2026-01-01T12:00:00.000Z')
    expect(dueAtIsoFromPicker('  x  ', parse)).toBe('2026-01-01T12:00:00.000Z')
    expect(parse).toHaveBeenCalledWith('  x  ')
    expect(dueAtIsoFromPicker('  ', parse)).toBeNull()
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('validateCreateTaskForm returns errors for bad input', () => {
    const parse = () => null
    expect(validateCreateTaskForm('', 'x', parse)).toBe('Title is required')
    expect(validateCreateTaskForm('t', '', parse)).toBe('Due date and time are required')
    expect(validateCreateTaskForm('t', 'x', parse)).toContain('invalid')
  })
})
