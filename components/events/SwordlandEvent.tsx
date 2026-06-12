import { EventHeader } from './EventHeader'
import { BattlePlanButton } from './BattlePlanButton'
import { SwordlandLegionBoard } from './SwordlandLegionBoard'
import { SwordlandFullPlan } from './SwordlandFullPlan'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Users, Shield } from 'lucide-react'

interface Props {
  event: any
  availability: any[]
  assignments: any[]
  members: any[]
  allianceId: string
  canManage: boolean
  userId?: string
}

export function SwordlandEvent({ event, availability, assignments, members, allianceId, canManage }: Props) {
  const rules = event.event_types?.rules || {}
  const attending = availability.filter(a => a.will_attend)
  const legion1Start = event.legion1_start_utc || event.battle_start_utc
  const legion2Start = event.legion2_start_utc
  // Same split as the plan generator: members without a chosen legion fold into
  // Legion 1 so they still receive an assignment.
  const legion1Attending = attending.filter(a => a.squad_preference !== 'legion2')
  const legion2Attending = attending.filter(a => a.squad_preference === 'legion2')

  const plan = event.battle_plan as any
  const gaps = plan?.coverage_gaps || []
  const recommendations = plan?.recommendations || []
  const warnings = plan?.warnings || []
  const joinerAdvice = plan?.joiner_stacking_advice
  const backupPlan = plan?.backup_plan

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <EventHeader event={event}>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="default">Legion size: {rules.legion_size || 30}</Badge>
          <Badge variant="default">Substitutes: {rules.substitute_slots || 10}</Badge>
          <Badge variant="amber">1 hour battle</Badge>
        </div>
      </EventHeader>

      {/* Key Rules */}
      {rules.key_rules && (
        <Card>
          <CardHeader><CardTitle>Key Rules</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
              {rules.key_rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dual-legion board: rosters, readiness, and manual assignment */}
      <SwordlandLegionBoard
        eventId={event.id}
        members={members}
        availability={availability}
        assignments={assignments}
        legion1Start={legion1Start}
        legion2Start={legion2Start}
        canManage={canManage}
      />

      {/* Generate Plan — one button per legion. The legions battle at completely
          different times in independent matches, so each plan is generated and
          stored on its own; generating one never touches the other. */}
      {canManage && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <BattlePlanButton
                  eventId={event.id}
                  legion="legion1"
                  label="Generate Legion 1 Battle Plan"
                  disabled={legion1Attending.length === 0}
                />
                <p className="text-xs text-slate-500">
                  {legion1Attending.length === 0
                    ? 'No attending members for Legion 1 yet.'
                    : `${legion1Attending.length} attending (includes members without a chosen legion).`}
                </p>
              </div>
              <div className="space-y-1.5">
                <BattlePlanButton
                  eventId={event.id}
                  legion="legion2"
                  label="Generate Legion 2 Battle Plan"
                  disabled={legion2Attending.length === 0}
                />
                <p className="text-xs text-slate-500">
                  {legion2Attending.length === 0
                    ? 'No attending members for Legion 2 yet.'
                    : `${legion2Attending.length} attending.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Gaps */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} /> Coverage Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 list-disc list-inside text-slate-300">
              {gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Plan Summary */}
      {plan?.summary && (
        <Card>
          <CardHeader><CardTitle>Battle Plan Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-slate-300 text-sm">{plan.summary}</p>
            {recommendations.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-400 mb-2">Recommendations:</p>
                <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                  {recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Joiner stacking advice */}
      {joinerAdvice && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><Users size={18} />Joiner Stacking Advice</CardTitle></CardHeader>
          <CardContent><p className="text-slate-300 text-sm">{joinerAdvice}</p></CardContent>
        </Card>
      )}

      {/* Backup plan */}
      {backupPlan && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} className="text-slate-400" />Backup Plan</CardTitle></CardHeader>
          <CardContent><p className="text-slate-300 text-sm">{backupPlan}</p></CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-red-400"><AlertTriangle size={18} />Warnings</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 list-disc list-inside text-red-300">
              {warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Full battle plan per legion: collapsible roster (rally leaders with their
          joiners, support, substitutes), shared stage instructions, per-member
          instruction cards. Renders nothing for a legion until its plan exists. */}
      <SwordlandFullPlan
        eventId={event.id}
        allianceTag={event.alliances?.tag || ''}
        assignments={assignments}
        battlePlan={plan}
        canManage={canManage}
      />

      {assignments.length === 0 && attending.length > 0 && canManage && (
        <p className="text-slate-400 text-sm text-center">
          {attending.length} members confirmed. Generate a battle plan to assign roles.
        </p>
      )}
    </div>
  )
}
