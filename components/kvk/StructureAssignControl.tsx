// @ts-nocheck
'use client'
// Manual structure override control (FIX 2): pick a player AND the exact position
// they should fill. Castle exposes Rally 1/2/3 for leaders and joiners; turrets
// expose a single rally; support is player-only. The save targets a serializable
// `endpoint` + `extraBody` (so the SAME control works from the KVK hub — a client
// component — and the Castle Battle event page — a server component — since no
// function props cross the server/client boundary). The endpoint receives:
//   { ...extraBody, structure, memberId, role, rallyNumber }
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserPlus, Loader2 } from 'lucide-react'

interface PoolPlayer { id: string; player_name: string; game_id?: string | null; tag?: string | null }

interface Props {
  structureKey: string
  structureLabel: string
  pool: PoolPlayer[]
  endpoint: string
  // Extra serializable fields merged into the POST body (e.g. { kingdomId } or { eventId }).
  extraBody: Record<string, any>
}

// Build the role/rally options for a given structure. Value encodes role + rally.
function optionsFor(structureKey: string): { value: string; label: string }[] {
  if (structureKey === 'support') {
    return [{ value: 'support:0', label: 'Support' }]
  }
  if (structureKey === 'castle') {
    return [
      { value: 'rally_leader:1', label: 'Rally Leader — Rally 1' },
      { value: 'rally_leader:2', label: 'Rally Leader — Rally 2' },
      { value: 'rally_leader:3', label: 'Rally Leader — Rally 3' },
      { value: 'joiner:1', label: 'Joiner — Rally 1' },
      { value: 'joiner:2', label: 'Joiner — Rally 2' },
      { value: 'joiner:3', label: 'Joiner — Rally 3' },
      { value: 'support:0', label: 'Support' },
    ]
  }
  // Turrets
  return [
    { value: 'rally_leader:1', label: 'Rally Leader' },
    { value: 'joiner:1', label: 'Joiner' },
    { value: 'support:0', label: 'Support' },
  ]
}

export function StructureAssignControl({ structureKey, structureLabel, pool, endpoint, extraBody }: Props) {
  const router = useRouter()
  const opts = optionsFor(structureKey)
  const isSupport = structureKey === 'support'
  const [memberId, setMemberId] = useState('')
  const [placement, setPlacement] = useState(opts[0].value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function assign() {
    if (!memberId || saving) return
    setSaving(true)
    setError('')
    try {
      const [role, rally] = (isSupport ? 'support:0' : placement).split(':')
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extraBody,
          structure: structureKey,
          memberId,
          role,
          rallyNumber: Number(rally) || 1,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign')
      }
      setMemberId('')
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to assign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-slate-800 pt-3">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
        <UserPlus size={12} /> Assign / override a player for {structureLabel}
      </p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={memberId}
          onChange={e => setMemberId(e.target.value)}
          className="flex-1 min-w-[180px] h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Select an attending player…</option>
          {pool.map(p => (
            <option key={p.id} value={p.id}>{p.tag ? `[${p.tag}] ` : ''}{p.player_name}</option>
          ))}
        </select>

        {!isSupport && (
          <select
            value={placement}
            onChange={e => setPlacement(e.target.value)}
            className="min-w-[170px] h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {opts.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        <Button onClick={assign} disabled={!memberId || saving} size="md">
          {saving ? <Loader2 size={16} className="mr-1 animate-spin" /> : null}
          Assign
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 mt-1">
        Overrides the AI recommendation for this player and is saved immediately. The player is removed from any previous assignment.
      </p>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
