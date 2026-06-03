'use client'
import { useState, useEffect } from 'react'
import { BadgeCheck } from 'lucide-react'

interface Props {
  /** The kingdom (server) number used by the Kingdom Tracker API. */
  kingdomNumber: number
}

interface TrackerData {
  kingdomId: number
  openTime: string
  isExclusive?: boolean
  languages?: string[]
  isVerified?: boolean
}

function formatOpened(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatAge(iso: string): string {
  const open = new Date(iso)
  if (isNaN(open.getTime())) return ''
  const now = new Date()
  let months = (now.getUTCFullYear() - open.getUTCFullYear()) * 12 + (now.getUTCMonth() - open.getUTCMonth())
  if (now.getUTCDate() < open.getUTCDate()) months -= 1
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  parts.push(`${rem} month${rem !== 1 ? 's' : ''}`)
  return parts.join(', ')
}

// FIX 10 — small subtle info bar under the kingdom name. Fails silently when the
// Kingdom Tracker API has no data for this kingdom.
export function KingdomAgeBar({ kingdomNumber }: Props) {
  const [data, setData] = useState<TrackerData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/kingdom-age?kingdomId=${encodeURIComponent(kingdomNumber)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancelled && json?.data?.openTime) setData(json.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [kingdomNumber])

  if (!data) return null

  const opened = formatOpened(data.openTime)
  const age = formatAge(data.openTime)

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mt-1">
      <span>
        Kingdom {data.kingdomId}
        {opened && <> — Opened {opened}</>}
        {age && <> — Age: <span className="text-amber-400 font-semibold">{age}</span></>}
      </span>
      {data.isVerified && (
        <span className="inline-flex items-center gap-0.5 text-green-400">
          <BadgeCheck size={12} /> Verified
        </span>
      )}
      {Array.isArray(data.languages) && data.languages.length > 0 && data.languages.map((lang) => (
        <span key={lang} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded uppercase">
          {lang}
        </span>
      ))}
    </div>
  )
}
