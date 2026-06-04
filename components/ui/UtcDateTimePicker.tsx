'use client'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/**
 * UTC date + time picker that is immune to the browser/OS locale.
 *
 * A native <input type="datetime-local"> renders its time portion using the
 * OS locale, which shows AM/PM for many users. To guarantee 24-hour UTC display
 * everywhere, this component splits the value into:
 *   - <input type="date">  for the date (locale-safe, always YYYY-MM-DD)
 *   - <select>             for the time, listing 00:00 … 23:45 in 24-hour format
 *
 * The `value`/`onChange` contract is identical to the datetime-local input it
 * replaces: a "YYYY-MM-DDTHH:mm" string (UTC wall-clock), so the existing
 * toDatetimeLocalUtc / fromDatetimeLocalUtc helpers keep working unchanged.
 */

// "00:00", "00:15", … "23:45"
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return opts
})()

interface Props {
  /** "YYYY-MM-DDTHH:mm" (UTC wall-clock) or "" */
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

export function UtcDateTimePicker({ value, onChange, className, disabled }: Props) {
  // Split the incoming combined value into its date and time parts.
  const [datePart, timePart] = useMemo(() => {
    if (!value) return ['', '']
    const [d, t = ''] = value.split('T')
    // Normalise a possible "HH:mm:ss" down to "HH:mm".
    return [d, t.slice(0, 5)]
  }, [value])

  // Guarantee any pre-existing (possibly off-grid, e.g. "12:37") time stays
  // selectable so the dropdown never silently drops a saved value.
  const timeOptions = useMemo(() => {
    if (timePart && !TIME_OPTIONS.includes(timePart)) {
      return [timePart, ...TIME_OPTIONS]
    }
    return TIME_OPTIONS
  }, [timePart])

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) {
      onChange('')
      return
    }
    // Default the time to 00:00 when a date is chosen but no time picked yet.
    onChange(`${nextDate}T${nextTime || '00:00'}`)
  }

  const fieldCls =
    'h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50'

  return (
    // flex-wrap lets the time dropdown drop below the date input in narrow
    // columns instead of overlapping it; min widths keep each field from
    // collapsing. w-full + min-w-0 prevent the picker from overflowing its cell.
    <div className={cn('flex flex-wrap gap-2 w-full min-w-0', className)}>
      <input
        type="date"
        value={datePart}
        disabled={disabled}
        onChange={e => emit(e.target.value, timePart)}
        className={cn(fieldCls, 'flex-1 min-w-[8.5rem]')}
      />
      <select
        value={timePart}
        disabled={disabled}
        onChange={e => emit(datePart, e.target.value)}
        className={cn(fieldCls, 'flex-1 min-w-[7rem]')}
        aria-label="Time (UTC, 24-hour)"
      >
        <option value="">--:-- UTC</option>
        {timeOptions.map(t => (
          <option key={t} value={t}>{t} UTC</option>
        ))}
      </select>
    </div>
  )
}
