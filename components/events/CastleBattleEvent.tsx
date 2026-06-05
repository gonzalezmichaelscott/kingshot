// @ts-nocheck
import { EventHeader } from './EventHeader'
import { AvailabilityPanel } from './AvailabilityPanel'
import { KvkAttendanceManager } from './KvkAttendanceManager'
import { AssignmentsTable } from './AssignmentsTable'
import { BattlePlanButton } from './BattlePlanButton'
import { CastleRallies } from '@/components/kvk/CastleRallies'
import { StructureAssignControl } from '@/components/kvk/StructureAssignControl'
import { buildCastleRallies, splitCastleRoles } from '@/lib/rally-fill'
import { isManualAssignment } from '@/lib/kvk'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Castle, Users, Shield, Check } from 'lucide-react'

interface Props {
  event: any
  availability: any[]
  assignments: any[]
  members: any[]
  allianceId: string
  canManage: boolean
  userId?: string
}

// Battle window is 12:00–17:00 UTC — 5 one-hour cycles starting at 12,13,14,15,16.
const HOURS = [12, 13, 14, 15, 16]
const STRUCTURES: { key: string; label: string }[] = [
  { key: 'castle', label: 'King Castle' },
  { key: 'north_turret', label: 'North Turret' },
  { key: 'east_turret', label: 'East Turret' },
  { key: 'south_turret', label: 'South Turret' },
  { key: 'west_turret', label: 'West Turret' },
]

export function CastleBattleEvent({ event, availability, assignments, members, allianceId, canManage }: Props) {
  const rules = event.event_types?.rules || {}
  const plan = event.battle_plan as any
  const gaps = plan?.coverage_gaps || []
  const recommendations = plan?.recommendations || []
  const warnings = plan?.warnings || []
  const joinerAdvice = plan?.joiner_stacking_advice
  const backupPlan = plan?.backup_plan

  // Map member_id → available UTC hour window [from, to] from submitted availability.
  const windowByMember: Record<string, [number, number]> = {}
  for (const a of availability) {
    if (!a.will_attend) continue
    const from = a.available_from_utc ? new Date(a.available_from_utc).getUTCHours() : 12
    const to = a.available_to_utc ? new Date(a.available_to_utc).getUTCHours() : 17
    windowByMember[a.member_id] = [from, to]
  }

  // Coverage matrix: for each structure × hour, how many assigned members are
  // available during that cycle. Falls back to attendance-only when no plan yet.
  const coverage: Record<string, Record<number, number>> = {}
  for (const s of STRUCTURES) {
    coverage[s.key] = {}
    const squadMembers = assignments.filter(a => a.squad === s.key)
    for (const h of HOURS) {
      let n = 0
      for (const a of squadMembers) {
        const w = windowByMember[a.member_id]
        // If we have no availability window, assume the assigned member covers it.
        if (!w || (h >= w[0] && h < w[1])) n++
      }
      coverage[s.key][h] = n
    }
  }
  const hasPlan = assignments.length > 0

  const bySquad = (key: string) => assignments.filter(a => a.squad === key)

  // FIX 5 — castle multi-rally allocation. Single-alliance event, so every rally
  // is from the same alliance (no transfers). march/rally come from the members.
  const memberById: Record<string, any> = {}
  for (const m of members) memberById[m.id] = m
  const castleAssignees = bySquad('castle').map((a: any) => {
    const m = memberById[a.member_id] || {}
    return {
      id: a.member_id,
      player_name: m.player_name || (a.members as any)?.player_name || 'Unknown',
      game_id: m.game_id || null,
      tag: null,
      role: a.role,
      is_backup: a.is_backup,
      isManual: isManualAssignment(a.reasoning),
      rally_number: a.rally_number ?? null,
      march_size: m.march_size || 0,
      rally_capacity: m.rally_capacity || 0,
    }
  })
  const { leaders: castleLeaders, joiners: castleJoiners } = splitCastleRoles(castleAssignees)
  const castleRallies = buildCastleRallies(castleLeaders, castleJoiners)

  // Attending players for the manual-assignment dropdowns.
  const attendingIds = new Set(availability.filter((a: any) => a.will_attend).map((a: any) => a.member_id))
  const assignPool = members
    .filter((m: any) => attendingIds.has(m.id))
    .map((m: any) => ({ id: m.id, player_name: m.player_name, game_id: m.game_id || null, tag: null }))

  const STRUCTURE_CONTROLS: { key: string; label: string }[] = [
    { key: 'castle', label: 'King Castle' },
    { key: 'north_turret', label: 'North Turret' },
    { key: 'east_turret', label: 'East Turret' },
    { key: 'south_turret', label: 'South Turret' },
    { key: 'west_turret', label: 'West Turret' },
    { key: 'support', label: 'Support' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <EventHeader event={event}>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="amber">Up to 5-Hour Battle</Badge>
          <Badge variant="default">Battle window 12:00–17:00 UTC</Badge>
          <Badge variant="green">Single Alliance</Badge>
        </div>
      </EventHeader>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="py-3 text-sm text-amber-200">
          <span className="font-semibold">Objective:</span> Hold the King Castle for 2.5 consecutive
          hours (instant win) or the most cumulative time. Four turrets surround the castle — each
          enemy-held turret deals 2% casualties per cycle to castle holders. Castle is top priority:
          staff it fully (2 teams) before assigning turrets.
        </CardContent>
      </Card>

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
            <p className="text-xs text-slate-500 mt-2">
              The AI planner fills the castle with 2 full teams first, then turrets (North → East → South → West) with remaining capacity.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual structure assignment — pick a player AND their exact position */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={18} className="text-amber-500" />
              Manual Assignment / Override
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {STRUCTURE_CONTROLS.map(sc => (
              <StructureAssignControl
                key={sc.key}
                structureKey={sc.key}
                structureLabel={sc.label}
                pool={assignPool}
                endpoint="/api/events/assign-structure"
                extraBody={{ eventId: event.id }}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Coverage matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield size={18} className="text-amber-500" />Coverage Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 mb-3">
            {hasPlan
              ? 'Assigned players available per structure for each battle cycle (12:00–17:00 UTC).'
              : 'No battle plan yet — generate a plan to populate per-structure coverage.'}
          </p>
          <div className="table-scroll">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 pr-4">Structure</th>
                  {HOURS.map(h => (
                    <th key={h} className="text-center py-2 px-2">{String(h).padStart(2, '0')}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STRUCTURES.map(s => (
                  <tr key={s.key} className="border-b border-slate-800/50">
                    <td className="py-2 pr-4 font-medium">{s.label}</td>
                    {HOURS.map(h => {
                      const n = coverage[s.key][h]
                      return (
                        <td key={h} className="text-center py-2 px-2">
                          {n > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-400">
                              <Check size={12} /> {n}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

      {joinerAdvice && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><Users size={18} />Joiner Stacking Advice</CardTitle></CardHeader>
          <CardContent><p className="text-slate-300 text-sm">{joinerAdvice}</p></CardContent>
        </Card>
      )}

      {backupPlan && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield size={18} className="text-slate-400" />Backup Plan</CardTitle></CardHeader>
          <CardContent><p className="text-slate-300 text-sm">{backupPlan}</p></CardContent>
        </Card>
      )}

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

      {castleRallies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Castle size={18} className="text-amber-500" />
              Castle — Rally Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">
              Fill the castle with {castleRallies.length >= 2 ? 'these full rallies' : 'this rally'} before turrets. Each rally is filled to its leader&apos;s capacity (rally capacity − march size).
            </p>
            <CastleRallies rallies={castleRallies} />
          </CardContent>
        </Card>
      )}
      {bySquad('north_turret').length > 0 && <AssignmentsTable assignments={bySquad('north_turret')} title="North Turret" />}
      {bySquad('east_turret').length > 0 && <AssignmentsTable assignments={bySquad('east_turret')} title="East Turret" />}
      {bySquad('south_turret').length > 0 && <AssignmentsTable assignments={bySquad('south_turret')} title="South Turret" />}
      {bySquad('west_turret').length > 0 && <AssignmentsTable assignments={bySquad('west_turret')} title="West Turret" />}
      {bySquad('support').length > 0 && <AssignmentsTable assignments={bySquad('support')} title="Support / Weakening" />}
    </div>
  )
}
