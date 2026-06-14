import { EventHeader } from './EventHeader'
import { SwordlandLegionBoard } from './SwordlandLegionBoard'
import { SwordlandPlanGenerator } from './SwordlandPlanGenerator'
import { SwordlandFullPlan } from './SwordlandFullPlan'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  event: any
  availability: any[]
  assignments: any[]
  members: any[]
  allianceId: string
  canManage: boolean
  userId?: string
  /** Team-based plan rows from swordland_assignments. */
  swordlandAssignments?: any[]
}

export function SwordlandEvent({ event, availability, assignments, members, allianceId, canManage, swordlandAssignments = [] }: Props) {
  const rules = event.event_types?.rules || {}
  const attending = availability.filter(a => a.will_attend)
  const legion1Start = event.legion1_start_utc || event.battle_start_utc
  const legion2Start = event.legion2_start_utc
  // Same split as the plan generator: members without a chosen legion fold into
  // Legion 1 so they still receive an assignment.
  const legion1Attending = attending.filter(a => a.squad_preference !== 'legion2')
  const legion2Attending = attending.filter(a => a.squad_preference === 'legion2')

  const hasLegion1Plan = swordlandAssignments.some(a => a.legion === 1)
  const hasLegion2Plan = swordlandAssignments.some(a => a.legion === 2)

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

      {/* Dual-legion board: rosters, readiness, and manual legion assignment */}
      <SwordlandLegionBoard
        eventId={event.id}
        members={members}
        availability={availability}
        assignments={assignments}
        legion1Start={legion1Start}
        legion2Start={legion2Start}
        canManage={canManage}
      />

      {/* Generate team-based plan — one independent button per legion. */}
      {canManage && (
        <SwordlandPlanGenerator
          eventId={event.id}
          legion1Count={legion1Attending.length}
          legion2Count={legion2Attending.length}
          hasLegion1Plan={hasLegion1Plan}
          hasLegion2Plan={hasLegion2Plan}
        />
      )}

      {/* Full team-based plan per legion: collapsible roster grouped by team
          (Attackers, Support, Defender A/B, Substitutes), shared phase
          instructions per team, per-member instruction cards. Renders nothing
          for a legion until its plan exists. */}
      <SwordlandFullPlan
        eventId={event.id}
        allianceTag={event.alliances?.tag || ''}
        assignments={swordlandAssignments}
        canManage={canManage}
      />

      {swordlandAssignments.length === 0 && attending.length > 0 && canManage && (
        <p className="text-slate-400 text-sm text-center">
          {attending.length} members confirmed. Generate a battle plan to assign teams.
        </p>
      )}
    </div>
  )
}
