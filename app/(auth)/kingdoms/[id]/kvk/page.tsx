// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sword, Shield, Users, Mic, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatPower } from '@/lib/utils'
import { KvkChatSection } from '@/components/kvk/KvkChatSection'
import { KvkStructureBoard } from '@/components/kvk/KvkStructureBoard'
import { KvkGeneratePlanButton } from '@/components/kvk/KvkGeneratePlanButton'
import { KvkReadiness } from '@/components/kvk/KvkReadiness'
import { findOrCreateKingdomKvkEvent, KVK_STRUCTURES } from '@/lib/kvk'

const LEADER_ROLE = /leader|castle|garrison/

export default async function KvkPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
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

  const alliances = ((kingdom.alliances as any[]) || []).filter(a => a.kvk_enabled)
  const allianceIds = alliances.map(a => a.id)
  const myAllianceKvkEnabled = alliances.some(a => a.id === profile?.alliance_id)

  // Access already verified — load cross-alliance data with the service client so
  // the kingdom-wide hub can see members/assignments across every alliance.
  const svc = createServiceClient()

  let allMembers: any[] = []
  if (allianceIds.length > 0) {
    const { data } = await svc
      .from('members')
      .select('*, alliances(name, tag), member_scores(*), member_combat_stats(troop_type_primary, id), member_heroes(id)')
      .in('alliance_id', allianceIds)
      .order('power', { ascending: false })
    allMembers = data || []
  }

  // Anchor event + its assignments / availability / voice channels
  const { event } = allianceIds.length > 0
    ? await findOrCreateKingdomKvkEvent(params.id, false)
    : { event: null }

  let assignments: any[] = []
  const availabilityByMember: Record<string, any> = {}
  if (event) {
    const [{ data: asg }, { data: avail }] = await Promise.all([
      svc.from('event_assignments')
        .select('*, members(id, player_name, alliances(tag))')
        .eq('event_id', event.id),
      svc.from('event_availability').select('*').eq('event_id', event.id),
    ])
    assignments = asg || []
    for (const a of avail || []) availabilityByMember[a.member_id] = a
  }

  const { data: voiceChannels } = await svc
    .from('kvk_voice_channels')
    .select('*')
    .eq('kingdom_id', params.id)
    .eq('is_active', true)

  // Which structures is the current user assigned to (gates structure voice visibility)
  const myMember = allMembers.find(m => m.linked_user_id === user.id)
  const myAssignedSquads = assignments
    .filter(a => a.member_id === myMember?.id)
    .map(a => a.squad)

  // ----- Coverage timeline (5 battle hours from 12:00 UTC, or anchored to event) -----
  const startHour = event?.battle_start_utc ? new Date(event.battle_start_utc).getUTCHours() : 12
  const startBase = event?.battle_start_utc ? new Date(event.battle_start_utc) : null
  const hourLabels = Array.from({ length: 5 }, (_, i) => `${String((startHour + i) % 24).padStart(2, '0')}:00`)

  function coverageFor(memberIds: string[]): boolean[] {
    return Array.from({ length: 5 }, (_, i) => {
      if (memberIds.length === 0) return false
      if (!startBase) return true // no battle time set — any assignment counts as coverage
      const hourStart = new Date(startBase.getTime() + i * 3600_000)
      const hourEnd = new Date(hourStart.getTime() + 3600_000)
      return memberIds.some(id => {
        const a = availabilityByMember[id]
        if (!a || (!a.available_from_utc && !a.available_to_utc)) return true // assumed full-event
        const from = a.available_from_utc ? new Date(a.available_from_utc) : new Date(-8640000000000000)
        const to = a.available_to_utc ? new Date(a.available_to_utc) : new Date(8640000000000000)
        return from < hourEnd && to > hourStart
      })
    })
  }

  function topByScore(field: string, n = 5) {
    return [...allMembers]
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
    tag: (a.members as any)?.alliances?.tag || null,
    role: a.role,
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
      voiceChannel: s.voiceChannel,
      voiceUrl: (voiceChannels || []).find(c => c.channel_name === s.voiceChannel)?.discord_invite_url || null,
      canSeeVoice: canManage || myAssignedSquads.includes(s.key),
      leader: leaderRow ? toAssignee(leaderRow) : null,
      joiners,
      recommended: topByScore(s.scoreField),
      coverage: coverageFor(memberIds),
    }
  })

  const pool = allMembers.map(m => ({
    id: m.id,
    player_name: m.player_name,
    tag: (m.alliances as any)?.tag || null,
  }))

  const battleLeaderUrl = (voiceChannels || []).find(c => c.channel_name === 'battle_leader')?.discord_invite_url
  const generalUrl = (voiceChannels || []).find(c => c.channel_name === 'general')?.discord_invite_url

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Sword className="text-amber-500" size={24} />
        KVK Command — {kingdom.name}
      </h1>

      {/* Participating Alliances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} className="text-amber-500" />
            Participating Alliances ({alliances.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alliances.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alliances.map((a: any) => {
                const count = allMembers.filter(m => m.alliance_id === a.id).length
                return (
                  <div key={a.id} className="bg-slate-800 rounded-xl p-4">
                    <p className="font-semibold text-amber-400">[{a.tag}]</p>
                    <p className="text-sm text-slate-300">{a.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{count} members</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No alliances have KVK enabled for this kingdom yet.</p>
          )}
        </CardContent>
      </Card>

      {alliances.length > 0 && (
        <>
          {/* Generate Kingdom Battle Plan */}
          {canGeneratePlan && (
            <Card>
              <CardContent className="py-4">
                <KvkGeneratePlanButton kingdomId={params.id} />
              </CardContent>
            </Card>
          )}

          {/* Clickable structure cards */}
          <KvkStructureBoard
            kingdomId={params.id}
            structures={structures}
            hourLabels={hourLabels}
            pool={pool}
            canManage={canManage}
          />

          {/* Readiness */}
          <KvkReadiness members={allMembers} />

          {/* Voice channels — general (all) + battle leader (R4/R5/admin) */}
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
              <p className="text-xs text-slate-500">
                Structure-specific channels appear inside each structure card for assigned members.
              </p>
              {canManage && (
                <Link href={`/kingdoms/${params.id}/kvk/voice`} className="inline-block text-amber-500 hover:text-amber-400 text-sm pt-1">
                  Manage Voice Channel Links →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Combined Member Pool */}
          {allMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={18} className="text-amber-500" />
                  Combined Member Pool ({allMembers.length} players)
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
                      {allMembers.slice(0, 50).map(m => {
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
                  {allMembers.length > 50 && (
                    <p className="text-center text-slate-500 text-xs py-2">Showing top 50 of {allMembers.length}</p>
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
