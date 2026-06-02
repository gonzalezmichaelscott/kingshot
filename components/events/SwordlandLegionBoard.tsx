// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Swords, Clock, CheckCircle } from 'lucide-react'
import { formatPower } from '@/lib/utils'

interface Props {
  eventId: string
  members: any[]
  availability: any[]
  assignments: any[]
  legion1Start: string | null
  legion2Start: string | null
  canManage: boolean
}

function fmtUtc(iso: string | null) {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' UTC'
}

export function SwordlandLegionBoard({ eventId, members, availability, assignments, legion1Start, legion2Start, canManage }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const attending = availability.filter(a => a.will_attend)
  const byLegion = (legion: string) => attending.filter(a => a.squad_preference === legion)
  const legion1 = byLegion('legion1')
  const legion2 = byLegion('legion2')
  const confirmedIds = new Set(attending.map(a => a.member_id))
  const assignedIds = new Set([...legion1, ...legion2].map(a => a.member_id))

  // Confirmed but no legion chosen + members who never responded — manual-assignable.
  const unassigned = [
    ...attending.filter(a => !assignedIds.has(a.member_id)).map(a => ({ id: a.member_id, player_name: (a.members as any)?.player_name, power: (a.members as any)?.power })),
    ...members.filter(m => !confirmedIds.has(m.id)).map(m => ({ id: m.id, player_name: m.player_name, power: m.power })),
  ]

  // Plan assignments grouped per legion (squad === 'legion1' | 'legion2')
  const planByLegion = (legion: string) => assignments.filter(a => a.squad === legion)

  async function assign(memberId: string, legion: string) {
    setBusy(memberId)
    const res = await fetch('/api/events/assign-legion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, member_id: memberId, legion }),
    })
    setBusy(null)
    if (res.ok) router.refresh()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to assign') }
  }

  function LegionColumn({ label, start, roster, plan }: { label: string; start: string | null; roster: any[]; plan: any[] }) {
    const total = members.length
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Swords size={18} className="text-amber-500" /> {label}
          </CardTitle>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock size={12} /> {fmtUtc(start)}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle size={12} /> {label}: {roster.length}/{total} members confirmed
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {roster.length === 0 && <p className="text-xs text-slate-500">No members in this legion yet.</p>}
          {roster.map(a => {
            const m = a.members as any
            const planRow = plan.find(p => p.member_id === a.member_id)
            return (
              <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium">{m?.player_name}</span>
                  {planRow && (
                    <Badge variant={planRow.role?.includes('leader') ? 'amber' : planRow.role?.includes('joiner') ? 'blue' : 'default'} className="ml-2 text-[10px]">
                      {planRow.role?.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-400">{m?.power ? formatPower(m.power) : ''}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <LegionColumn label="Legion 1" start={legion1Start} roster={legion1} plan={planByLegion('legion1')} />
        <LegionColumn label="Legion 2" start={legion2Start} roster={legion2} plan={planByLegion('legion2')} />
      </div>

      {/* Manual legion assignment for unassigned / non-responding members */}
      {canManage && unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign Members to a Legion</CardTitle>
            <p className="text-xs text-slate-400">For members who told you in-game which legion they&apos;ll join.</p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {unassigned.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 bg-slate-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium">{m.player_name}</span>
                  {m.power ? <span className="text-xs text-slate-400 ml-2">{formatPower(m.power)}</span> : null}
                </div>
                <select
                  defaultValue=""
                  disabled={busy === m.id}
                  onChange={e => { if (e.target.value) assign(m.id, e.target.value) }}
                  className="h-9 px-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="" disabled>Assign to…</option>
                  <option value="legion1">Legion 1</option>
                  <option value="legion2">Legion 2</option>
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
