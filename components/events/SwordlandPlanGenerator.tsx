'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Swords, Loader2 } from 'lucide-react'

interface Props {
  eventId: string
  legion1Count: number
  legion2Count: number
  hasLegion1Plan: boolean
  hasLegion2Plan: boolean
}

/**
 * Two independent per-legion generate buttons for Swordland. The legions battle
 * at completely separate times in independent matches, so each plan is generated
 * and stored on its own — generating one never affects the other.
 */
export function SwordlandPlanGenerator({ eventId, legion1Count, legion2Count, hasLegion1Plan, hasLegion2Plan }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords size={18} className="text-amber-500" /> Generate Team-Based Battle Plan
        </CardTitle>
        <p className="text-xs text-slate-400">
          Swordland is a building-capture event — players DISPERSE into Attacker / Support / Defender teams.
          Each legion is planned independently.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LegionButton eventId={eventId} legion={1} count={legion1Count} hasPlan={hasLegion1Plan} />
          <LegionButton eventId={eventId} legion={2} count={legion2Count} hasPlan={hasLegion2Plan} />
        </div>
      </CardContent>
    </Card>
  )
}

function LegionButton({ eventId, legion, count, hasPlan }: { eventId: string; legion: 1 | 2; count: number; hasPlan: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/swordland/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legionNumber: legion }),
      })
    } catch {
      setBusy(false)
      setError('Network error — plan was not generated. Please try again.')
      return
    }
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Plan generation failed')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-1.5">
      <Button onClick={generate} disabled={busy || count === 0} className="w-full">
        {busy ? (
          <><Loader2 size={16} className="mr-2 animate-spin" /> Generating Legion {legion}…</>
        ) : (
          <>{hasPlan ? 'Regenerate' : 'Generate'} Legion {legion} Battle Plan</>
        )}
      </Button>
      <p className="text-xs text-slate-500">
        {count === 0
          ? `No attending members for Legion ${legion} yet.`
          : `${count} attending${legion === 1 ? ' (includes members without a chosen legion)' : ''}.`}
      </p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
