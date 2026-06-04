const UK_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** e.g. 1 → st, 2 → nd, 3 → rd, 4 → th, 11 → th */
export function ordinalSuffix(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  const mod10 = day % 10
  if (mod10 === 1) return 'st'
  if (mod10 === 2) return 'nd'
  if (mod10 === 3) return 'rd'
  return 'th'
}

/** UK display: `1st Apr 2026` (spaces, no slashes). */
export function formatUKOrdinalDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const mon = UK_MONTH_SHORT[d.getMonth()] ?? 'Jan'
  return `${day}${ordinalSuffix(day)} ${mon} ${d.getFullYear()}`
}

export function formatUKDateString(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

const UK_ORDINAL_MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

/**
 * Parse `1st Apr 2026` / `22nd April 2026` (case-insensitive month).
 * Returns a Date in local time at 00:00:00, or null if invalid.
 */
export function parseUKOrdinalDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  const match = /^(\d{1,2})(st|nd|rd|th)\s+([a-z]+)\s+(\d{4})$/i.exec(trimmed)
  if (!match) return null

  const day = Number(match[1])
  const monthKey = match[3].toLowerCase()
  const year = Number(match[4])
  const month = UK_ORDINAL_MONTHS[monthKey]
  if (!Number.isFinite(day) || month === undefined || !Number.isFinite(year)) return null

  const d = new Date(year, month, day)
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/**
 * Parse strict DD-MM-YYYY (rejects ambiguous formats).
 * Returns a Date in local time at 00:00:00.
 */
export function parseUKDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // Accept strictly DD-MM-YYYY to avoid US-style ambiguity.
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed)
  if (!match) return null

  const [, dd, mm, yyyy] = match
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)

  const d = new Date(year, month - 1, day)
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/** Parses a date string from either a native date input (YYYY-MM-DD) or UK text (DD-MM-YYYY). */
export function parseDateInput(dateStr: string): Date | null {
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Use a midday timestamp to reduce timezone edge cases.
    const d = new Date(trimmed + 'T12:00:00')
    return Number.isNaN(d.getTime()) ? null : d
  }

  const ordinal = parseUKOrdinalDate(trimmed)
  if (ordinal) return ordinal

  return parseUKDate(trimmed)
}

/** Returns DD-MM-YYYY for display in any date field (e.g. from localStorage). */
export function toDisplayDate(dateStr: string): string {
  const d = parseDateInput(dateStr)
  return d ? formatUKDateString(d) : ''
}

export function parse12HourTime(
  timeStr: string,
  period: 'AM' | 'PM',
): { hours: number; minutes: number } | null {
  const trimmed = timeStr.trim()
  if (!trimmed) return null

  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null

  if (period === 'PM' && hours < 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  return { hours, minutes }
}

/**
 * Value for SveltyPicker datetime in UK format: dd-mm-yyyy H:ii AM/PM (no leading zero on hour).
 * Note: this intentionally uses 12-hour time with "AM"/"PM" to match UI expectations.
 */
export function toDateTimePickerValue(d: Date): string {
  const datePart = formatUKDateString(d)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  const hh = String(hours)
  return `${datePart} ${hh}:${minutes} ${period}`
}

/**
 * Parse SveltyPicker datetime string (dd-mm-yyyy HH:ii P) to ISO string, or null if invalid.
 *
 * Output is a full ISO string, e.g. `2026-02-01T15:05:00.000Z`.
 */
export function parseDateTimeUK(s: string): string | null {
  const trimmed = s?.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/)
  if (parts.length < 3) return null

  const last = parts[parts.length - 1]?.toUpperCase()
  const timeToken = parts[parts.length - 2]
  let datePart: string
  let timePart: string
  let periodPart: 'AM' | 'PM'

  if ((last === 'AM' || last === 'PM') && timeToken && /^\d{1,2}:\d{2}$/.test(timeToken)) {
    periodPart = last === 'PM' ? 'PM' : 'AM'
    timePart = timeToken
    datePart = parts.slice(0, -2).join(' ')
  } else if (parts.length === 3) {
    // Legacy: `02-01-2026 3:05 PM` (date is a single token)
    datePart = parts[0] ?? ''
    timePart = parts[1] ?? ''
    periodPart = (parts[2]?.toUpperCase() === 'PM' ? 'PM' : 'AM') as 'AM' | 'PM'
  } else {
    return null
  }

  const d = parseDateInput(datePart)
  const t = parse12HourTime(timePart, periodPart)
  if (!d || !t) return null

  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hours, t.minutes, 0, 0)
  return Number.isNaN(due.getTime()) ? null : due.toISOString()
}

/**
 * Format an ISO timestamp as `1st Apr 2026 1:07 pm` for UI and text search (12-hour, no leading zero on hour, lowercase am/pm).
 * Returns original `value` unchanged if invalid.
 */
export function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  const datePart = formatUKOrdinalDate(d)

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const period = hours >= 12 ? 'pm' : 'am'

  hours = hours % 12
  if (hours === 0) hours = 12
  const hh = String(hours)

  return `${datePart} ${hh}:${minutes} ${period}`
}

/**
 * Format an ISO timestamp for UK admin views (same style as {@link formatDate}).
 */
export function formatDateTimeUK(value: string): string {
  return formatDate(value)
}

/** Format a stored filter boundary (DD-MM-YYYY, ISO date, or ordinal) for chip labels. */
export function formatDueFilterChipDate(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const d = parseDateInput(trimmed)
  return d ? formatUKOrdinalDate(d) : trimmed
}

