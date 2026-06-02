import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPower(power: number): string {
  if (power >= 1_000_000_000) return `${(power / 1_000_000_000).toFixed(2)}B`
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(2)}M`
  if (power >= 1_000) return `${(power / 1_000).toFixed(1)}K`
  return power.toString()
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

export function roleColor(role: string): string {
  const map: Record<string, string> = {
    rally_leader: 'text-amber-400',
    joiner: 'text-blue-400',
    support: 'text-green-400',
    garrison: 'text-purple-400',
    flex: 'text-slate-400',
  }
  return map[role] || 'text-slate-400'
}

// ───────────────────────── UTC time formatting ─────────────────────────
// Kingshot runs entirely on UTC (Prime Meridian / GMT). Every time shown to a
// player must be 24-hour UTC — never the viewer's local time, never AM/PM.
// These helpers force timeZone:'UTC' + hour12:false (en-GB guarantees 24-hour)
// so display is consistent regardless of the browser's locale or timezone.

// "2 Jun 2026, 14:30 UTC"
export function formatUtcDateTime(input?: string | number | Date | null): string {
  if (input === null || input === undefined || input === '') return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' UTC'
}

// "2 Jun 2026" (date only — no time, no UTC suffix by default)
export function formatUtcDate(
  input?: string | number | Date | null,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (input === null || input === undefined || input === '') return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts })
}

// "14:30 UTC" (time only, 24-hour)
export function formatUtcTime(input?: string | number | Date | null): string {
  if (input === null || input === undefined || input === '') return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' UTC'
}

// ISO timestamp → "YYYY-MM-DDTHH:mm" using UTC wall-clock components, for the
// `value` of a <input type="datetime-local">. The input then shows UTC time.
export function toDatetimeLocalUtc(iso?: string | number | Date | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

// datetime-local value (a UTC wall-clock string like "2026-06-02T14:30") → ISO
// string with explicit Z, for storage in a timestamptz column.
export function fromDatetimeLocalUtc(value?: string | null): string | null {
  if (!value) return null
  const s = value.length === 16 ? value + ':00' : value
  const d = new Date(s + 'Z')
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function troopTypeColor(type: string): string {
  const map: Record<string, string> = {
    infantry: 'text-red-400',
    cavalry: 'text-blue-400',
    archer: 'text-green-400',
    all: 'text-amber-400',
    mixed: 'text-purple-400',
  }
  return map[type] || 'text-slate-400'
}
