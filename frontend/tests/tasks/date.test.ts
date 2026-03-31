import { describe, expect, it, vi } from 'vitest'

import {
  formatDate,
  formatUKDateString,
  parse12HourTime,
  parseDateInput,
  parseDateTimeUK,
  parseUKDate,
  toDateTimePickerValue,
  toDisplayDate,
} from '../../src/lib/tasks/date'

describe('date utilities', () => {
  it('formatUKDateString formats DD-MM-YYYY', () => {
    const d = new Date(2026, 2, 7, 0, 0, 0, 0) // 07-03-2026
    expect(formatUKDateString(d)).toBe('07-03-2026')
  })

  it('parseUKDate is strict DD-MM-YYYY', () => {
    const d = parseUKDate('26-03-2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(26)

    expect(parseUKDate('6-03-2026')).toBeNull()
    expect(parseUKDate('32-01-2026')).toBeNull()
    expect(parseUKDate('29-02-2025')).toBeNull()
  })

  it('parseDateInput accepts YYYY-MM-DD and DD-MM-YYYY', () => {
    const d1 = parseDateInput('2026-03-06')
    expect(d1).not.toBeNull()
    expect(d1!.getFullYear()).toBe(2026)
    expect(d1!.getMonth()).toBe(2)
    expect(d1!.getDate()).toBe(6)

    const d2 = parseDateInput('06-03-2026')
    expect(d2).not.toBeNull()
    expect(d2!.getFullYear()).toBe(2026)
    expect(d2!.getMonth()).toBe(2)
    expect(d2!.getDate()).toBe(6)
  })

  it('toDisplayDate returns DD-MM-YYYY or empty string', () => {
    expect(toDisplayDate('2026-03-06')).toBe('06-03-2026')
    expect(toDisplayDate('06-03-2026')).toBe('06-03-2026')
    expect(toDisplayDate('not-a-date')).toBe('')
  })

  it('parse12HourTime parses AM/PM correctly', () => {
    expect(parse12HourTime('12:30', 'PM')).toEqual({ hours: 12, minutes: 30 })
    expect(parse12HourTime('12:30', 'AM')).toEqual({ hours: 0, minutes: 30 })
    expect(parse12HourTime('3:05', 'PM')).toEqual({ hours: 15, minutes: 5 })
    expect(parse12HourTime('03:05', 'AM')).toEqual({ hours: 3, minutes: 5 })

    expect(parse12HourTime('13:00', 'PM')).toBeNull()
    expect(parse12HourTime('0:00', 'AM')).toBeNull()
    expect(parse12HourTime('3:5', 'AM')).toBeNull()
  })

  it('toDateTimePickerValue formats Date to dd-mm-yyyy HH:ii P', () => {
    const d = new Date(2026, 0, 2, 15, 5, 0, 0)
    expect(toDateTimePickerValue(d)).toBe('02-01-2026 03:05 PM')
  })

  it('parseDateTimeUK parses SveltyPicker values to ISO', () => {
    const input = '02-01-2026 03:05 PM'
    const expected = new Date(2026, 0, 2, 15, 5, 0, 0).toISOString()
    expect(parseDateTimeUK(input)).toBe(expected)
  })

  it('parseDateTimeUK returns null for invalid input', () => {
    expect(parseDateTimeUK('')).toBeNull()
    expect(parseDateTimeUK('02-01-2026 03:05')).toBeNull() // missing period
    expect(parseDateTimeUK('not a date')).toBeNull()
  })

  it('formatDate formats ISO timestamp as DD-MM-YYYY hh:mm AM/PM', () => {
    const local = new Date(2026, 0, 2, 13, 7, 0, 0)
    const iso = local.toISOString()
    expect(formatDate(iso)).toBe('02-01-2026 01:07 PM')

    expect(formatDate('not-an-iso')).toBe('not-an-iso')
  })
})

