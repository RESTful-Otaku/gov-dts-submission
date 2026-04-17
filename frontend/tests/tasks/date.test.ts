import { describe, expect, it, vi } from 'vitest'

import {
  formatDate,
  formatDateTimeUK,
  formatDueFilterChipDate,
  formatUKDateString,
  formatUKOrdinalDate,
  ordinalSuffix,
  parse12HourTime,
  parseDateInput,
  parseDateTimeUK,
  parseUKDate,
  parseUKOrdinalDate,
  toDateTimePickerValue,
  toDisplayDate,
} from '../../src/lib/tasks/date'

describe('date utilities', () => {
  it('ordinalSuffix handles 11th–13th and 21st–23rd', () => {
    expect(ordinalSuffix(1)).toBe('st')
    expect(ordinalSuffix(2)).toBe('nd')
    expect(ordinalSuffix(3)).toBe('rd')
    expect(ordinalSuffix(4)).toBe('th')
    expect(ordinalSuffix(11)).toBe('th')
    expect(ordinalSuffix(12)).toBe('th')
    expect(ordinalSuffix(13)).toBe('th')
    expect(ordinalSuffix(21)).toBe('st')
    expect(ordinalSuffix(22)).toBe('nd')
    expect(ordinalSuffix(23)).toBe('rd')
  })

  it('formatUKOrdinalDate formats as D{st|nd|rd|th} Mon YYYY', () => {
    expect(formatUKOrdinalDate(new Date(2026, 3, 1))).toBe('1st Apr 2026')
    expect(formatUKOrdinalDate(new Date(2026, 3, 2))).toBe('2nd Apr 2026')
    expect(formatUKOrdinalDate(new Date(2026, 3, 3))).toBe('3rd Apr 2026')
    expect(formatUKOrdinalDate(new Date(2026, 3, 4))).toBe('4th Apr 2026')
  })

  it('parseUKOrdinalDate parses short and full month names', () => {
    const d1 = parseUKOrdinalDate('1st Apr 2026')
    expect(d1).not.toBeNull()
    expect(d1!.getFullYear()).toBe(2026)
    expect(d1!.getMonth()).toBe(3)
    expect(d1!.getDate()).toBe(1)

    const d2 = parseUKOrdinalDate('22nd April 2026')
    expect(d2).not.toBeNull()
    expect(d2!.getDate()).toBe(22)

    expect(parseUKOrdinalDate('32nd Apr 2026')).toBeNull()
    expect(parseUKOrdinalDate('not a date')).toBeNull()
  })

  it('parseDateInput accepts ordinal UK dates', () => {
    const d = parseDateInput('4th Apr 2026')
    expect(d).not.toBeNull()
    expect(d!.getMonth()).toBe(3)
    expect(d!.getDate()).toBe(4)
  })

  it('formatDueFilterChipDate maps stored boundaries to ordinal labels', () => {
    expect(formatDueFilterChipDate('26-03-2026')).toBe('26th Mar 2026')
    expect(formatDueFilterChipDate('4th Apr 2026')).toBe('4th Apr 2026')
  })

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
    expect(toDateTimePickerValue(d)).toBe('02-01-2026 3:05 PM')
  })

  it('parseDateTimeUK parses SveltyPicker values to ISO', () => {
    const input = '02-01-2026 3:05 PM'
    const expected = new Date(2026, 0, 2, 15, 5, 0, 0).toISOString()
    expect(parseDateTimeUK(input)).toBe(expected)
  })

  it('parseDateTimeUK returns null for invalid input', () => {
    expect(parseDateTimeUK('')).toBeNull()
    expect(parseDateTimeUK('02-01-2026 03:05')).toBeNull() // missing period
    expect(parseDateTimeUK('not a date')).toBeNull()
  })

  it('formatDate formats ISO timestamp as ordinal date and 12-hour time', () => {
    const local = new Date(2026, 0, 2, 13, 7, 0, 0)
    const iso = local.toISOString()
    expect(formatDate(iso)).toBe('2nd Jan 2026 1:07 pm')

    expect(formatDate('not-an-iso')).toBe('not-an-iso')
  })

  it('formatDateTimeUK matches formatDate for admin timestamps', () => {
    const local = new Date(2026, 0, 2, 13, 7, 0, 0)
    const iso = local.toISOString()
    expect(formatDateTimeUK(iso)).toBe(formatDate(iso))

    expect(formatDateTimeUK('not-an-iso')).toBe('not-an-iso')
  })

  it('parseDateTimeUK accepts ordinal date part', () => {
    const input = '2nd Jan 2026 3:05 PM'
    const expected = new Date(2026, 0, 2, 15, 5, 0, 0).toISOString()
    expect(parseDateTimeUK(input)).toBe(expected)
  })
})

