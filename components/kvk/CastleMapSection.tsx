// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Castle, ChevronDown, ChevronUp, RotateCcw, Loader2 } from 'lucide-react'
import { CastleMap } from '@/components/kvk/CastleMap'

interface Props {
  kingdomId: string
  eventId: string | null
  members: { id: string; player_name: string; game_id?: string | null; tag?: string | null }[]
  initialAssignments: { member_id: string; slot_position: string }[]
  roleByMember: Record<string, { role: string; squad: string; rally_number: number | null }>
  canManage: boolean
}

// FEATURE 3 — collapsible Castle Positioning Map section for the KVK Command hub.
// Collapsed by default; expands on click. Sits between Structure Assignments and
// Kingdom Readiness.
export function CastleMapSection({ kingdomId, eventId, members, initialAssignments, roleByMember, canManage }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function resetToPlan() {
    setResetting(true)
    try {
      await fetch('/api/kvk/city-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kingdomId }),
      })
      router.refresh()
    } finally {
      setResetting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Castle size={18} className="text-amber-500" />
            Castle Positioning Map
          </CardTitle>
          {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-400 max-w-lg">
              Assign member city positions for the castle battle. Positions closest to the castle are front line.
              {canManage ? ' Tap a slot to assign or remove a player.' : ' View only — ask your R4/R5 to adjust positions.'}
            </p>
            {canManage && (
              <button onClick={resetToPlan} disabled={resetting}
                className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
                {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                Reset to Battle Plan Positions
              </button>
            )}
          </div>
          <CastleMap
            eventId={eventId}
            members={members}
            initialAssignments={initialAssignments}
            roleByMember={roleByMember}
            canManage={canManage}
          />
        </CardContent>
      )}
    </Card>
  )
}
