// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sword, Shield, Users, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatPower } from '@/lib/utils'
import { KvkChatSection } from '@/components/kvk/KvkChatSection'

export default async function KvkPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: kingdom } = await supabase
    .from('kingdoms')
    .select('*, alliances(id, name, tag, kvk_enabled)')
    .eq('id', params.id)
    .single()

  if (!kingdom) notFound()

  const alliances = (kingdom.alliances as any[])?.filter(a => a.kvk_enabled) || []

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, alliance_id')
    .eq('id', user?.id || '')
    .single()

  const canSeeVoice = ['r5', 'r4', 'kingdom_leader', 'system_admin'].includes(profile?.role || '')
  const canGeneratePlan = ['r5', 'system_admin'].includes(profile?.role || '')

  // Check if current user's alliance has KVK enabled
  const myAllianceKvkEnabled = alliances.some(a => a.id === profile?.alliance_id)

  // Load all members from all KVK-participating alliances
  let allMembers: any[] = []
  if (alliances.length > 0) {
    const allianceIds = alliances.map(a => a.id)
    const { data: members } = await supabase
      .from('members')
      .select('*, alliances(name, tag), member_scores(overall_score, rally_leader_score, joiner_score), member_combat_stats(troop_type_primary)')
      .in('alliance_id', allianceIds)
      .order('power', { ascending: false })
    allMembers = members || []
  }

  // Readiness per alliance (members with power > 0 and combat stats)
  const allianceStats = alliances.map(a => {
    const allianceMembers = allMembers.filter(m => m.alliance_id === a.id)
    const total = allianceMembers.length
    const ready = allianceMembers.filter(m => m.power > 0 && (m.member_combat_stats as any[])?.length > 0).length
    const readiness = total > 0 ? Math.round(ready / total * 100) : 0
    return { ...a, memberCount: total, readiness }
  })

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
              {allianceStats.map((a: any) => (
                <div key={a.id} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-amber-400">[{a.tag}]</p>
                    <Badge variant={a.readiness > 70 ? 'green' : a.readiness > 40 ? 'amber' : 'default'}>
                      {a.readiness}% ready
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300">{a.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{a.memberCount} members</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No alliances have KVK enabled for this kingdom.</p>
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
                    const alliance = (m.alliances as any)
                    return (
                      <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 pr-3 font-medium text-slate-200">{m.player_name}</td>
                        <td className="py-2 pr-3">
                          <span className="text-xs text-amber-400">[{alliance?.tag}]</span>
                        </td>
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

      {/* Structure Assignments Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={18} className="text-amber-500" />
            Structure Coverage Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['Castle', 'North Turret', 'East Turret', 'South Turret', 'West Turret', 'Support'].map(structure => {
              const count = Math.floor(allMembers.length / 6)
              return (
                <div key={structure} className="bg-slate-800 rounded-lg p-3">
                  <p className="text-sm font-semibold text-slate-200">{structure}</p>
                  <p className="text-xs text-slate-400 mt-1">~{count} players available</p>
                  <p className="text-xs text-amber-400 mt-0.5">Use AI planner to assign</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Generate a Kingdom Battle Plan from any KVK Castle event page to get precise assignments across all participating alliances.
          </p>
        </CardContent>
      </Card>

      {/* Voice channels */}
      {canSeeVoice && (
        <Card>
          <CardHeader>
            <CardTitle>Voice Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/kingdoms/${params.id}/kvk/voice`} className="text-amber-500 hover:text-amber-400 text-sm">
              Manage Voice Channel Links →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KVK Command Chat */}
      {myAllianceKvkEnabled && user && profile && (
        <KvkChatSection
          kingdomId={params.id}
          currentUserId={user.id}
          currentUserRole={profile.role || ''}
          allianceId={profile.alliance_id || ''}
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
