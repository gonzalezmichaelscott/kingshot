import { EventHeader } from './EventHeader'
import { AssignmentsTable } from './AssignmentsTable'
import { SwordlandLegionBoard } from './SwordlandLegionBoard'
import { TriAlliancePlanner } from './TriAlliancePlanner'
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
  triAssignments?: any[]
}

export function TriAllianceEvent({ event, availability, assignments, members, allianceId, canManage, triAssignments = [] }: Props) {
  const rules = event.event_types?.rules || {}
  const stages = rules.stages || []
  const legion1Start = event.legion1_start_utc || event.battle_start_utc
  const legion2Start = event.legion2_start_utc
  const plan = event.battle_plan as any
  const gaps = plan?.coverage_gaps || []
  const recommendations = plan?.recommendations || []

  const garrisonTeam = assignments.filter(a => a.role?.includes('garrison'))
  const templeTeam = assignments.filter(a => a.role?.includes('temple'))
  const defenders = assignments.filter(a => a.role?.includes('defend'))
  const others = assignments.filter(a =>
    !a.role?.includes('garrison') && !a.role?.includes('temple') && !a.role?.includes('defend')
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <EventHeader event={event}>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="amber">1-Hour Battle</Badge>
          <Badge variant="default">3 Alliances Compete</Badge>
        </div>
      </EventHeader>

      {/* Phase Timeline */}
      <Card>
        <CardHeader><CardTitle>Phase Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stages.map((stage: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-16 text-xs text-amber-400 font-mono">
                  {stage.start_minute !== undefined ? `${stage.start_minute}m` : '0m'}
                </div>
                <div className="flex-1 bg-slate-800 rounded-lg p-2">
                  <p className="font-medium text-sm">{stage.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{stage.description}</p>
                </div>
                <div className="text-xs text-slate-500 flex-shrink-0">{stage.duration_minutes}min</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {/* Dual-legion board: rosters, readiness, and manual assignment (same structure as Swordland) */}
      <SwordlandLegionBoard
        eventId={event.id}
        members={members}
        availability={availability}
        assignments={assignments}
        legion1Start={legion1Start}
        legion2Start={legion2Start}
        canManage={canManage}
      />

      {/* Role-based battle planner: commander designation, generation, rosters */}
      <TriAlliancePlanner
        eventId={event.id}
        allianceTag={event.alliances?.tag || ''}
        availability={availability}
        triAssignments={triAssignments}
        canManage={canManage}
      />

      {/* Coverage Gaps */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-amber-400"><AlertTriangle size={18} />Coverage Gaps</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 list-disc list-inside text-slate-300">
              {gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

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

      {garrisonTeam.length > 0 && <AssignmentsTable assignments={garrisonTeam} title="Garrison Team (Phase 3)" />}
      {templeTeam.length > 0 && <AssignmentsTable assignments={templeTeam} title="Temple Assault (Phase 4)" />}
      {defenders.length > 0 && <AssignmentsTable assignments={defenders} title="Defenders" />}
      {others.length > 0 && <AssignmentsTable assignments={others} title="Other Assignments" />}
    </div>
  )
}
