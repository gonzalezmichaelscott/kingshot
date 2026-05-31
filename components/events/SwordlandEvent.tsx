import { EventHeader } from './EventHeader'
import { AvailabilityPanel } from './AvailabilityPanel'
import { AssignmentsTable } from './AssignmentsTable'
import { BattlePlanButton } from './BattlePlanButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

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
  const squadA = assignments.filter(a => a.squad === 'A')
  const squadB = assignments.filter(a => a.squad === 'B')
  const backups = assignments.filter(a => a.is_backup)

  const plan = event.battle_plan as any
  const gaps = plan?.coverage_gaps || []
  const recommendations = plan?.recommendations || []

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

      {/* Availability */}
      <AvailabilityPanel
        members={members}
        availability={availability}
        allianceId={allianceId}
        eventId={event.id}
      />

      {/* Generate Plan */}
      {canManage && (
        <Card>
          <CardContent className="py-4">
            <BattlePlanButton eventId={event.id} />
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

      {/* Squad A */}
      {squadA.length > 0 && (
        <AssignmentsTable assignments={squadA} title="Squad A" />
      )}

      {/* Squad B */}
      {squadB.length > 0 && (
        <AssignmentsTable assignments={squadB} title="Squad B" />
      )}

      {/* Backups */}
      {backups.length > 0 && (
        <AssignmentsTable assignments={backups} title="Substitutes" />
      )}

      {assignments.length === 0 && attending.length > 0 && canManage && (
        <p className="text-slate-400 text-sm text-center">
          {attending.length} members confirmed. Generate a battle plan to assign roles.
        </p>
      )}
    </div>
  )
}
