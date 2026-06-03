'use client'
import { useState } from 'react'
import { Timer } from 'lucide-react'
import { RallyTimerSession } from './RallyTimerSession'

interface Props {
  session: any
  allianceId: string | null
}

// FIX 7 — editable view of a shared rally timer for the session creator and
// alliance leadership (R4/R5/system_admin). Wraps the full editor component so
// leaders can add players and control the timer from the shared link too.
export function SharedTimerEditor({ session, allianceId }: Props) {
  const [current, setCurrent] = useState(session)

  return (
    <div className="min-h-screen bg-slate-950 p-4 flex items-start justify-center">
      <div className="w-full max-w-md space-y-4 pt-8">
        <div className="flex items-center gap-2">
          <Timer className="text-amber-500" size={22} />
          <h1 className="text-xl font-bold">Rally Timer</h1>
          <span className="ml-auto text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
            Editor
          </span>
        </div>
        <RallyTimerSession
          session={current}
          canEdit
          allianceId={allianceId}
          onUpdate={(updated) => setCurrent((prev: any) => ({ ...prev, ...updated }))}
        />
      </div>
    </div>
  )
}
