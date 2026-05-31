'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, CheckCircle, XCircle } from 'lucide-react'
import { formatPower } from '@/lib/utils'

interface Props {
  members: any[]
  availability: any[]
  allianceId: string
  eventId: string
}

export function AvailabilityPanel({ members, availability, allianceId, eventId }: Props) {
  const attendingIds = new Set(availability.filter(a => a.will_attend).map(a => a.member_id))
  const notRespondedIds = members.filter(m => !availability.find(a => a.member_id === m.id))

  const attending = availability.filter(a => a.will_attend)
  const declined = availability.filter(a => !a.will_attend)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={18} className="text-amber-500" />
          Availability ({attending.length} attending / {members.length} total)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Attending */}
          <div>
            <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1">
              <CheckCircle size={14} /> Attending ({attending.length})
            </h4>
            <div className="space-y-1">
              {attending.map(a => {
                const m = a.members as any
                return (
                  <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium">{m?.player_name}</span>
                      {a.squad_preference && (
                        <span className="text-xs text-slate-400 ml-2">Squad {a.squad_preference}</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{m?.power ? formatPower(m.power) : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Not responded */}
          {notRespondedIds.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">
                No Response ({notRespondedIds.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {notRespondedIds.map(m => (
                  <span key={m.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                    {m.player_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Declined */}
          {declined.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                <XCircle size={14} /> Declined ({declined.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {declined.map(a => (
                  <span key={a.id} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                    {(a.members as any)?.player_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
