// @ts-nocheck
// Alliance calendar helpers. All dates are handled in UTC — the game runs on UTC.

export interface CalendarEvent {
  id: string
  alliance_id: string
  title: string
  description: string | null
  event_date: string // ISO timestamptz
  end_date: string | null
  is_recurring: boolean
  recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom' | null
  recurrence_interval_days: number | null
  recurrence_end_date: string | null
  color: string
  created_by: string | null
  created_at: string
}

export const CALENDAR_COLORS: Record<string, { dot: string; badge: string; ring: string }> = {
  amber: { dot: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', ring: 'ring-amber-500' },
  red: { dot: 'bg-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/40', ring: 'ring-red-500' },
  green: { dot: 'bg-green-500', badge: 'bg-green-500/20 text-green-300 border-green-500/40', ring: 'ring-green-500' },
  blue: { dot: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40', ring: 'ring-blue-500' },
  purple: { dot: 'bg-purple-500', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', ring: 'ring-purple-500' },
}

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  custom: 'Custom interval',
}

// A single concrete occurrence of an event on a specific UTC day.
export interface Occurrence {
  event: CalendarEvent
  date: Date // UTC midnight of the occurrence day
}

// UTC date key "YYYY-MM-DD" for an instant.
export function utcDayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

// UTC midnight Date for a given "YYYY-MM-DD" key.
export function dayFromKey(key: string): Date {
  return new Date(key + 'T00:00:00.000Z')
}

// Step interval (in days) for fixed-interval recurrences. Monthly is handled
// separately because months are not a fixed number of days.
function intervalDays(ev: CalendarEvent): number | null {
  switch (ev.recurrence_type) {
    case 'daily': return 1
    case 'weekly': return 7
    case 'biweekly': return 14
    case 'custom': return ev.recurrence_interval_days && ev.recurrence_interval_days > 0 ? ev.recurrence_interval_days : null
    default: return null
  }
}

// Expand an event into every occurrence whose day falls within [rangeStart, rangeEnd]
// (inclusive, both UTC-midnight aligned). Non-recurring events yield at most one.
export function expandOccurrences(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const out: Occurrence[] = []
  const start = new Date(ev.event_date)
  if (isNaN(start.getTime())) return out

  // First occurrence's UTC midnight.
  const firstDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))

  if (!ev.is_recurring || !ev.recurrence_type) {
    if (firstDay >= rangeStart && firstDay <= rangeEnd) out.push({ event: ev, date: firstDay })
    return out
  }

  const hardEnd = ev.recurrence_end_date ? new Date(ev.recurrence_end_date) : null
  // Cap iterations to avoid runaway loops on bad data.
  const MAX = 1000

  if (ev.recurrence_type === 'monthly') {
    let y = firstDay.getUTCFullYear()
    let m = firstDay.getUTCMonth()
    const dom = firstDay.getUTCDate()
    for (let i = 0; i < MAX; i++) {
      const occ = new Date(Date.UTC(y, m, dom))
      if (occ > rangeEnd) break
      if (hardEnd && occ > hardEnd) break
      if (occ >= rangeStart) out.push({ event: ev, date: occ })
      m += 1
      if (m > 11) { m = 0; y += 1 }
    }
    return out
  }

  const step = intervalDays(ev)
  if (!step) {
    // Misconfigured recurring event — fall back to the single start day.
    if (firstDay >= rangeStart && firstDay <= rangeEnd) out.push({ event: ev, date: firstDay })
    return out
  }

  const cursor = new Date(firstDay)
  for (let i = 0; i < MAX; i++) {
    if (cursor > rangeEnd) break
    if (hardEnd && cursor > hardEnd) break
    if (cursor >= rangeStart) out.push({ event: ev, date: new Date(cursor) })
    cursor.setUTCDate(cursor.getUTCDate() + step)
  }
  return out
}

// All occurrences across a list of events within a UTC date range, grouped by day key.
export function occurrencesByDay(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): Record<string, Occurrence[]> {
  const map: Record<string, Occurrence[]> = {}
  for (const ev of events) {
    for (const occ of expandOccurrences(ev, rangeStart, rangeEnd)) {
      const key = utcDayKey(occ.date)
      ;(map[key] ||= []).push(occ)
    }
  }
  return map
}

// The next N upcoming occurrences from `now`, sorted ascending (for the dashboard widget).
export function upcomingOccurrences(events: CalendarEvent[], now: Date, count: number): Occurrence[] {
  // Look ahead one year for recurring events.
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setUTCFullYear(rangeEnd.getUTCFullYear() + 1)

  const all: Occurrence[] = []
  for (const ev of events) {
    for (const occ of expandOccurrences(ev, rangeStart, rangeEnd)) {
      // Use the event's wall-clock time on the occurrence day for ordering/filtering.
      const start = new Date(ev.event_date)
      const instant = new Date(Date.UTC(
        occ.date.getUTCFullYear(), occ.date.getUTCMonth(), occ.date.getUTCDate(),
        start.getUTCHours(), start.getUTCMinutes(),
      ))
      if (instant >= now) all.push({ event: ev, date: instant })
    }
  }
  all.sort((a, b) => a.date.getTime() - b.date.getTime())
  return all.slice(0, count)
}
