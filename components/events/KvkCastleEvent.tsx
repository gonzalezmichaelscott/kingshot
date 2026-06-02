import { EventHeader } from './EventHeader'
import { AvailabilityPanel } from './AvailabilityPanel'
import { KvkAttendanceManager } from './KvkAttendanceManager'
import { AssignmentsTable } from './AssignmentsTable'
import { BattlePlanButton } from './BattlePlanButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Castle, Users, Shield } from 'lucide-react'

interface Props {
  event: any
  availability: any[]
  assignments: any[]
  members: any[]
  allianceId: string
  canManage: boolean
  userId?: string
}

export function KvkCastleEvent({ event, availability, assignments, members, allianceId, canManage }: Props) {
  const rules = event.event_types?.rules || {}
  const attending = availability.filter(a => a.will_attend)
  const plan = event.battle_plan as any
  const gaps = plan?.coverage_gaps || []
  const recommendations = plan?.recommendations || []
  const warnings = plan?.warnings || []
  const joinerAdvice = plan?.joiner_stacking_advice
  const backupPlan = plan?.backup_plan

  const castleTeam = assignments.filter(a => a.squad === 'castle')
  const northTurret = assignments.filter(a => a.squad === 'north_turret')
  const eastTurret = assignments.filter(a => a.squad === 'east_turret')
  const southTurret = assignments.filter(a => a.squad === 'south_turret')
  const westTurret = assignments.filter(a => a.squad === 'west_turret')
  const support = assignments.filter(a => a.squad === 'support')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <EventHeader event={event}>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="amber">5-Hour Battle</Badge>
          <Badge variant="default">Battle starts 12:00 UTC</Badge>
          <Badge variant="blue">Multi-Alliance</Badge>
        </div>
      </EventHeader>

      {/* Optimal Formations */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Castle size={18} className="text-amber-500" />Optimal Formations</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-400 mb-2">Rally Formation</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Infantry</span><span>50%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cavalry</span><span>20%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Archer</span><span>30%</span></div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-400 mb-2">Garrison Formation</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Infantry</span><span>60%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cavalry</span><span>20%</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Archer</span><span>20%</span></div>
            </div>
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

      {/* Availability */}
      <AvailabilityPanel members={members} availability={availability} allianceId={allianceId} eventId={event.id} />

      {/* R4/R5 attendance management */}
      {canManage && (
        <KvkAttendanceManager
          members={members}
          availability={availability}
          eventId={event.id}
          battleStartUtc={event.battle_start_utc}
        />
      )}

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

      {castleTeam.length > 0 && <AssignmentsTable assignments={castleTeam} title="Castle Team" />}
      {northTurret.length > 0 && <AssignmentsTable assignments={northTurret} title="North Turret" />}
      {eastTurret.length > 0 && <AssignmentsTable assignments={eastTurret} title="East Turret" />}
      {southTurret.length > 0 && <AssignmentsTable assignments={southTurret} title="South Turret" />}
      {westTurret.length > 0 && <AssignmentsTable assignments={westTurret} title="West Turret" />}
      {support.length > 0 && <AssignmentsTable assignments={support} title="Support / Weakening" />}
    </div>
  )
}
