// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Swords, Loader2 } from 'lucide-react'
import { formatPower } from '@/lib/utils'

interface Props {
  eventId: string
  allianceTag: string
  availability: any[]
  triAssignments: any[]
  canManage: boolean
}

/**
 * Battle plan generation controls (commander designation + generate button).
 * The generated plan itself is displayed by TriAllianceFullPlan on the event
 * page, which also offers regeneration and substitute call-ups.
 */
export function TriAlliancePlanner({ eventId, allianceTag, availability, triAssignments, canManage }: Props) {
  if (!canManage) return null
  return (
    <div className="space-y-6">
      {[1, 2].map(legion => (
        <LegionPlanner
          key={legion}
          legion={legion}
          eventId={eventId}
          availability={availability}
          hasPlan={triAssignments.some(a => a.legion === legion)}
        />
      ))}
    </div>
  )
}

function LegionPlanner({ legion, eventId, availability, hasPlan }: any) {
  const router = useRouter()
  const attending = availability.filter(a => a.will_attend && a.squad_preference === `legion${legion}`)
  const [commander1, setCommander1] = useState('')
  const [commander2, setCommander2] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const canGenerate = attending.length >= 15

  async function generate() {
    setGenerating(true)
    setError('')
    const commanderIds = [commander1, commander2].filter(Boolean)
    let res: Response
    try {
      res = await fetch('/api/tri-alliance/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, legionNumber: legion, commanderIds }),
      })
    } catch {
      setGenerating(false)
      setError('Network error — plan was not generated. Please try again.')
      return
    }
    setGenerating(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Plan generation failed')
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords size={18} className="text-amber-500" />
          Legion {legion} Plan Generator
        </CardTitle>
        <p className="text-xs text-slate-400">
          {attending.length} member{attending.length === 1 ? '' : 's'} attending Legion {legion}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 bg-slate-800/60 border border-slate-700 rounded-xl p-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Designate Commanders (buff management role — pick your most active players)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <CommanderSelect value={commander1} onChange={setCommander1} attending={attending} exclude={commander2} placeholder="Commander 1 (optional)" />
              <CommanderSelect value={commander2} onChange={setCommander2} attending={attending} exclude={commander1} placeholder="Commander 2 (optional)" />
            </div>
          </div>
          <Button onClick={generate} disabled={!canGenerate || generating} className="w-full sm:w-auto">
            {generating ? (
              <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating Legion {legion} plan…</>
            ) : (
              <>{hasPlan ? 'Regenerate' : 'Generate'} Battle Plan — Legion {legion}</>
            )}
          </Button>
          {!canGenerate && (
            <p className="text-xs text-slate-500">Needs at least 15 attending members to generate (has {attending.length}).</p>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function CommanderSelect({ value, onChange, attending, exclude, placeholder }: any) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <option value="">{placeholder}</option>
      {attending.map((a: any) => {
        const m = a.members
        if (!m || m.id === exclude) return null
        return <option key={m.id} value={m.id}>{m.player_name} ({formatPower(m.power || 0)})</option>
      })}
    </select>
  )
}
