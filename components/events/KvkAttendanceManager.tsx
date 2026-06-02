// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { formatPower } from '@/lib/utils'

// KVK Castle Battle window is 12:00–17:00 UTC (5 hours).
const WIN_START = 12
const WIN_END = 17
const fmtHour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

interface Props {
  members: any[]
  availability: any[]
  eventId: string
  battleStartUtc?: string | null
}

/**
 * R4/R5 attendance management for a KVK Castle Battle event. Lets a leader set
 * any member's status (Attending / Not Attending / No Response) and availability
 * hours on their behalf. Saved to event_availability with manually_set_by.
 */
export function KvkAttendanceManager({ members, availability, eventId, battleStartUtc }: Props) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)

  // Build the event's calendar date (UTC) for constructing availability timestamps.
  const baseDate = battleStartUtc ? new Date(battleStartUtc) : new Date()
  const y = baseDate.getUTCFullYear()
  const mo = baseDate.getUTCMonth()
  const da = baseDate.getUTCDate()
  const tsForHour = (h: number) => new Date(Date.UTC(y, mo, da, h, 0, 0)).toISOString()

  const availByMember: Record<string, any> = {}
  for (const a of availability) availByMember[a.member_id] = a

  async function setStatus(member: any, status: 'attending' | 'not_attending' | 'no_response', fromH?: number, toH?: number) {
    setSavingId(member.id)
    await fetch('/api/kvk/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        member_id: member.id,
        status,
        available_from_utc: status === 'attending' ? tsForHour(fromH ?? WIN_START) : null,
        available_to_utc: status === 'attending' ? tsForHour(toH ?? WIN_START + 1) : null,
      }),
    })
    setSavingId(null)
    router.refresh()
  }

  function statusOf(a: any): 'attending' | 'not_attending' | 'no_response' {
    if (!a) return 'no_response'
    return a.will_attend ? 'attending' : 'not_attending'
  }

  const fromHours: number[] = []
  for (let h = WIN_START; h <= WIN_END - 1; h++) fromHours.push(h)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-amber-500" />
          Manage Attendance ({members.length} members)
        </CardTitle>
        <p className="text-xs text-slate-400">
          Set attendance and availability on a member's behalf. Members will see "Attendance confirmed by your alliance leader".
        </p>
      </CardHeader>
      <CardContent>
        <div className="table-scroll max-h-[28rem] overflow-y-auto">
          <div className="space-y-1.5 min-w-[560px]">
            {members.map(m => {
              const a = availByMember[m.id]
              const status = statusOf(a)
              const curFrom = a?.available_from_utc ? new Date(a.available_from_utc).getUTCHours() : WIN_START
              const curTo = a?.available_to_utc ? new Date(a.available_to_utc).getUTCHours() : WIN_START + 1
              const toHours: number[] = []
              for (let h = curFrom + 1; h <= WIN_END; h++) toHours.push(h)
              const busy = savingId === m.id
              return (
                <div key={m.id} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 flex-wrap">
                  <div className="flex-1 min-w-[120px]">
                    <span className="text-sm font-medium text-slate-200">{m.player_name}</span>
                    {a?.manually_set_by && <span className="ml-2 text-[10px] text-amber-400/80">leader-set</span>}
                    <span className="block text-xs text-slate-500">{m.power ? formatPower(m.power) : ''}</span>
                  </div>

                  {/* Segmented status control */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
                    {([
                      { key: 'attending', label: 'Attending', on: 'bg-green-600 text-white' },
                      { key: 'not_attending', label: 'Not', on: 'bg-red-600 text-white' },
                      { key: 'no_response', label: 'No Resp.', on: 'bg-slate-600 text-white' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        disabled={busy}
                        onClick={() => setStatus(m, opt.key, curFrom, curTo)}
                        className={`px-2.5 py-1.5 transition-colors ${status === opt.key ? opt.on : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Availability hours — only when attending */}
                  {status === 'attending' && (
                    <div className="flex items-center gap-1 text-xs">
                      <select
                        value={curFrom}
                        disabled={busy}
                        onChange={e => {
                          const nf = parseInt(e.target.value)
                          setStatus(m, 'attending', nf, Math.max(nf + 1, Math.min(curTo, WIN_END)))
                        }}
                        className="h-8 px-2 bg-slate-900 border border-slate-700 rounded text-slate-200"
                      >
                        {fromHours.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                      <span className="text-slate-500">–</span>
                      <select
                        value={Math.max(curTo, curFrom + 1)}
                        disabled={busy}
                        onChange={e => setStatus(m, 'attending', curFrom, parseInt(e.target.value))}
                        className="h-8 px-2 bg-slate-900 border border-slate-700 rounded text-slate-200"
                      >
                        {toHours.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
                      </select>
                      <span className="text-slate-500">UTC</span>
                    </div>
                  )}

                  {busy && <Loader2 size={14} className="animate-spin text-amber-400" />}
                </div>
              )
            })}
            {members.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No members in this alliance yet.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
