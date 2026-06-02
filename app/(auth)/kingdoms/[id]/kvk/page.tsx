// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sword, Shield, Users, Mic, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatPower } from '@/lib/utils'
import { KvkChatSection } from '@/components/kvk/KvkChatSection'
import { KvkStructureBoard } from '@/components/kvk/KvkStructureBoard'
import { KvkGeneratePlanButton } from '@/components/kvk/KvkGeneratePlanButton'
import { KvkNewCycleButton } from '@/components/kvk/KvkNewCycleButton'
import { KvkReadiness } from '@/components/kvk/KvkReadiness'
import { KvkPlanModePanel } from '@/components/kvk/KvkPlanModePanel'
import { KvkSyncButton } from '@/components/kvk/KvkSyncButton'
import { getKvkContext, loadAttendingKvkMembers, KVK_STRUCTURES, isManualAssignment } from '@/lib/kvk'
import { KeepAwake } from '@/components/ui/KeepAwake'
import { createServiceClient } from '@/lib/supabase/server'

const LEADER_ROLE = /leader|castle|garrison/

export default async function KvkPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, kvk_enabled)')
    .eq('id', params.id)
    .single()
  if (!kingdom) notFound()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, alliance_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role || ''
  const isBackend = ['r5', 'r4', 'kingdom_leader', 'system_admin'].includes(role)
  const kingdomAllianceIds = ((kingdom.alliances as any[]) || []).map(a => a.id)
  const isGlobal = ['system_admin', 'kingdom_leader'].includes(role)
  const hasAccess = isBackend && (isGlobal || kingdomAllianceIds.includes(profile?.alliance_id))
  if (!hasAccess) redirect('/dashboard')

  const canGeneratePlan = ['r5', 'system_admin'].includes(role)
  const canManage = ['r5', 'r4', 'kingdom_leader', 'system_admin'].includes(role)
  const canSeeBattleLeader = canManage

  // ---- Per-alliance KVK context (FIX 2): active events + attendance only ----
  const { eventType, alliances: ctx } = await getKvkContext(params.id)
  const participating = ctx // all kvk_enabled alliances
  const activeAlliances = participating.filter(a => a.activeEvent)
  const activeEventIds = activeAlliances.map(a => a.activeEvent.id)
  const myAllianceKvkEnabled = participating.some(a => a.id === profile?.alliance_id)

  const attendingMembers = await loadAttendingKvkMembers(activeEventIds)

  // Per-alliance attendance counts + warnings
  const attendingByAlliance: Record<string, number> = {}
  for (const m of attendingMembers) attendingByAlliance[m.alliance_id] = (attendingByAlliance[m.alliance_id] || 0) + 1

  const warnings: string[] = []
  for (const a of participating) {
    if (!a.activeEvent) {
      warnings.push(`${a.name} has no active KVK Castle Battle event — ask your R4 or R5 to create one and collect attendance from members`)
    } else if (!attendingByAlliance[a.id]) {
      warnings.push(`${a.name} — 0 members confirmed attending`)
    }
  }

  // KVK Complete (FIX 7): no active events but a prior completed one exists
  const completedEvents = participating.map(a => a.event).filter(e => e && e.status === 'completed')
  const kvkComplete = activeAlliances.length === 0 && completedEvents.length > 0
  const latestEndUtc = completedEvents
    .map(e => e.battle_end_utc)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null

  // ---- Assignments across active events (service client; access already verified) ----
  const svc = createServiceClient()
  let assignments: any[] = []
  if (activeEventIds.length > 0) {
    const { data: asg } = await svc
      .from('event_assignments')
      .select('*, members(id, player_name, game_id, alliances(tag))')
      .in('event_id', activeEventIds)
    assignments = asg || []
  }
  const hasPlan = assignments.length > 0

  // Transfer recommendations from the most recent stored Plan B (if any).
  let transferRecommendations: any[] = []
  for (const a of activeAlliances) {
    const recs = (a.activeEvent?.battle_plan as any)?.transfer_recommendations
    if (Array.isArray(recs) && recs.length > 0) { transferRecommendations = recs; break }
  }

  const { data: voiceChannels } = await svc
    .from('kvk_voice_channels')
    .select('*')
    .eq('kingdom_id', params.id)
    .eq('is_active', true)

  // availability map (from attending members) for coverage timeline
  const availabilityByMember: Record<string, any> = {}
  for (const m of attendingMembers) availabilityByMember[m.id] = m._availability

  const myMember = attendingMembers.find(m => m.linked_user_id === user.id)
  const myAssignedSquads = assignments.filter(a => a.member_id === myMember?.id).map(a => a.squad)

  // Coverage timeline (5 hours anchored to the earliest active event start, else 12:00)
  const anchorStart = activeAlliances.map(a => a.activeEvent.battle_start_utc).filter(Boolean).sort()[0] || null
  const startBase = anchorStart ? new Date(anchorStart) : null
  const startHour = startBase ? startBase.getUTCHours() : 12
  const hourLabels = Array.from({ length: 5 }, (_, i) => `${String((startHour + i) % 24).padStart(2, '0')}:00`)

  function coverageFor(memberIds: string[]): boolean[] {
    return Array.from({ length: 5 }, (_, i) => {
      if (memberIds.length === 0) return false
      if (!startBase) return true
      const hourStart = new Date(startBase.getTime() + i * 3600_000)
      const hourEnd = new Date(hourStart.getTime() + 3600_000)
      return memberIds.some(id => {
        const a = availabilityByMember[id]
        if (!a || (!a.available_from_utc && !a.available_to_utc)) return true
        const from = a.available_from_utc ? new Date(a.available_from_utc) : new Date(-8640000000000000)
        const to = a.available_to_utc ? new Date(a.available_to_utc) : new Date(8640000000000000)
        return from < hourEnd && to > hourStart
      })
    })
  }

  function topByScore(field: string, n = 5) {
    return [...attendingMembers]
      .map(m => ({
        id: m.id,
        player_name: m.player_name,
        tag: (m.alliances as any)?.tag,
        score: (m.member_scores as any)?.[0]?.[field] ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
  }

  const toAssignee = (a: any) => ({
    id: a.member_id,
    player_name: (a.members as any)?.player_name || 'Unknown',
    game_id: (a.members as any)?.game_id || null,
    tag: (a.members as any)?.alliances?.tag || null,
    role: a.role,
    isManual: isManualAssignment(a.reasoning),
    kvk_transfer: !!a.kvk_transfer,
  })

  const structures = KVK_STRUCTURES.map(s => {
    const squadAssignments = assignments.filter(a => a.squad === s.key)
    const leaderRow =
      squadAssignments.find(a => LEADER_ROLE.test(a.role || '') && a.is_primary && !a.is_backup) ||
      squadAssignments.find(a => LEADER_ROLE.test(a.role || ''))
    const joiners = squadAssignments.filter(a => a !== leaderRow).map(toAssignee)
    const memberIds = squadAssignments.map(a => a.member_id)
    return {
      key: s.key,
      label: s.label,
      formation: s.formation,
      voiceChannel: s.voiceChannel,
      voiceUrl: (voiceChannels || []).find(c => c.channel_name === s.voiceChannel)?.discord_invite_url || null,
      canSeeVoice: canManage || myAssignedSquads.includes(s.key),
      leader: leaderRow ? toAssignee(leaderRow) : null,
      joiners,
      recommended: topByScore(s.scoreField),
      coverage: coverageFor(memberIds),
    }
  })

  const pool = attendingMembers.map(m => ({
    id: m.id,
    player_name: m.player_name,
    game_id: m.game_id || null,
    tag: (m.alliances as any)?.tag || null,
  }))

  const battleLeaderUrl = (voiceChannels || []).find(c => c.channel_name === 'battle_leader')?.discord_invite_url
  const generalUrl = (voiceChannels || []).find(c => c.channel_name === 'general')?.discord_invite_url

  const kingdomName = kingdom.name

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Keep the screen awake while leaders coordinate KVK (no visible badge) */}
      <KeepAwake active={true} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sword className="text-amber-500" size={24} />
          KVK Command — {kingdomName}
        </h1>
        <KvkSyncButton />
      </div>

      {/* KVK Complete banner (FIX 7) */}
      {kvkComplete && (
        <Card className="border-green-600/40">
          <CardContent className="py-4">
            <div className="flex items-start gap-3 flex-wrap">
              <CheckCircle2 className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1 min-w-[220px]">
                <p className="font-semibold text-green-400">KVK Complete</p>
                <p className="text-sm text-slate-400">
                  The last KVK ended{latestEndUtc ? ` on ${new Date(latestEndUtc).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} UTC` : ''}.
                  Start a new planning cycle to collect fresh attendance for the next KVK.
                </p>
              </div>
              {canGeneratePlan && <KvkNewCycleButton kingdomId={params.id} />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings (FIX 2) */}
      {warnings.length > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 space-y-1.5">
            {warnings.map((w, i) => (
              <p key={i} className="text-sm text-amber-300 flex items-center gap-2">
                <AlertTriangle size={14} className="flex-shrink-0" /> {w}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Participating Alliances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} className="text-amber-500" />
            Participating Alliances ({participating.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participating.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {participating.map((a: any) => (
                <div key={a.id} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-amber-400">[{a.tag}]</p>
                    {a.activeEvent
                      ? <Badge variant="green">Active</Badge>
                      : <Badge variant="default">No event</Badge>}
                  </div>
                  <p className="text-sm text-slate-300">{a.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{attendingByAlliance[a.id] || 0} attending</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No alliances have KVK enabled for this kingdom yet.</p>
          )}
        </CardContent>
      </Card>

      {participating.length > 0 && (
        <>
          {/* Generate Kingdom Battle Plan — Plan A / Plan B + Transfer Recommendations */}
          {(canGeneratePlan && activeAlliances.length > 0) || transferRecommendations.length > 0 ? (
            <KvkPlanModePanel
              kingdomId={params.id}
              canGenerate={canGeneratePlan && activeAlliances.length > 0}
              transferRecommendations={transferRecommendations}
            />
          ) : null}

          {/* Structure cards (FIX 6) */}
          <KvkStructureBoard
            kingdomId={params.id}
            structures={structures}
            hourLabels={hourLabels}
            pool={pool}
            canManage={canManage}
            canGeneratePlan={canGeneratePlan && activeAlliances.length > 0}
            hasPlan={hasPlan}
          />

          {/* Readiness — attending members only (FIX 6/readiness) */}
          <KvkReadiness members={attendingMembers} />

          {/* Voice channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic size={18} className="text-amber-500" />
                Voice Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {generalUrl && (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                  <span className="font-medium">General</span>
                  <a href={generalUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <ExternalLink size={14} /> Join
                  </a>
                </div>
              )}
              {canSeeBattleLeader && battleLeaderUrl && (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                  <span className="font-medium">Battle Leader <span className="text-xs text-slate-500">(R4/R5/admin)</span></span>
                  <a href={battleLeaderUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <ExternalLink size={14} /> Join
                  </a>
                </div>
              )}
              <p className="text-xs text-slate-500">Structure-specific channels appear inside each structure card for assigned members.</p>
              {canManage && (
                <Link href={`/kingdoms/${params.id}/kvk/voice`} className="inline-block text-amber-500 hover:text-amber-400 text-sm pt-1">
                  Manage Voice Channel Links →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Combined attending pool */}
          {attendingMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={18} className="text-amber-500" />
                  Confirmed Attending ({attendingMembers.length} players)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="table-scroll">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="text-left py-2 pr-3">Player</th>
                        <th className="text-left py-2 pr-3">Alliance</th>
                        <th className="text-right py-2 pr-3">Power</th>
                        <th className="text-right py-2 pr-3">March</th>
                        <th className="text-left py-2 pr-3">Troop</th>
                        <th className="text-right py-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...attendingMembers].sort((a, b) => (b.power || 0) - (a.power || 0)).slice(0, 50).map(m => {
                        const score = (m.member_scores as any)?.[0]?.overall_score ?? 0
                        const troopType = (m.member_combat_stats as any)?.[0]?.troop_type_primary
                        const alliance = m.alliances as any
                        return (
                          <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 pr-3 font-medium text-slate-200">{m.player_name}</td>
                            <td className="py-2 pr-3"><span className="text-xs text-amber-400">[{alliance?.tag}]</span></td>
                            <td className="text-right py-2 pr-3 text-slate-300">{formatPower(m.power)}</td>
                            <td className="text-right py-2 pr-3 text-slate-400">{formatPower(m.march_size)}</td>
                            <td className="py-2 pr-3">
                              {troopType && (
                                <Badge variant={troopType === 'infantry' ? 'red' : troopType === 'cavalry' ? 'blue' : troopType === 'archer' ? 'green' : 'default'} className="text-xs">
                                  {troopType}
                                </Badge>
                              )}
                            </td>
                            <td className="text-right py-2 font-mono text-slate-300">{score.toFixed(1)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {attendingMembers.length > 50 && (
                    <p className="text-center text-slate-500 text-xs py-2">Showing top 50 of {attendingMembers.length}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* KVK Command Chat */}
      {myAllianceKvkEnabled && (
        <KvkChatSection
          kingdomId={params.id}
          currentUserId={user.id}
          currentUserRole={role}
          allianceId={profile?.alliance_id || ''}
        />
      )}

      {!myAllianceKvkEnabled && (
        <Card>
          <CardContent className="py-4">
            <p className="text-slate-400 text-sm text-center">
              Your alliance must have KVK enabled to access the KVK Command Chat.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
