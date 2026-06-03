// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { annotateExistingProfiles } from '@/lib/approvals'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import Link from 'next/link'
import { formatPower } from '@/lib/utils'
import { AddMemberButton } from '@/components/members/AddMemberButton'
import { CopyTokenButton } from '@/components/members/CopyTokenButton'
import { PendingProfileRequests } from '@/components/members/PendingProfileRequests'
import { PendingClaimRequests } from '@/components/members/PendingClaimRequests'
import { RemoveMemberButton } from '@/components/members/RemoveMemberButton'
import { ImportMembersButton } from '@/components/members/ImportMembersButton'
import { requireAllianceAccess, canManageAlliance, visibleRequestRolesFor } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'

export default async function MembersPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { profile } = await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('name, tag, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()
  if (!alliance) notFound()

  const kingdom = (alliance as any).kingdoms

  const canManage = canManageAlliance(profile?.role)
  const isAdmin = profile?.role === 'system_admin'

  // FIX 8 — a cached avatar is "fresh" for 14 days; after that PlayerAvatar
  // re-fetches and re-caches it.
  const AVATAR_TTL_MS = 14 * 24 * 60 * 60 * 1000
  const freshAvatar = (m: any) =>
    m.avatar_url && m.avatar_fetched_at && (Date.now() - new Date(m.avatar_fetched_at).getTime() < AVATAR_TTL_MS)
      ? m.avatar_url
      : null

  // R5 sees R1-R5 requests for their alliance (elevated R4/R5 requests route to
  // the alliance R5 when one exists); R4 sees only R1-R3.
  const visibleRequestRoles = visibleRequestRolesFor(profile?.role)
  const { data: pendingRequests } = (canManage && visibleRequestRoles.length > 0) ? await supabase
    .from('profile_requests')
    .select('*')
    .eq('alliance_id', params.id)
    .eq('status', 'pending')
    .in('requested_role', visibleRequestRoles)
    .order('created_at', { ascending: false }) : { data: [] }

  // Flag rejoin requests (player already has a profile with stats) for approvers.
  const annotatedPendingRequests = canManage
    ? await annotateExistingProfiles(createServiceClient(), pendingRequests || [])
    : (pendingRequests || [])

  // Pending profile claim requests for this alliance
  const { data: rawClaimRequests } = canManage ? await supabase
    .from('profile_claim_requests')
    .select('id, member_id, requesting_user_id, created_at, members(player_name, game_id)')
    .eq('alliance_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false }) : { data: [] }

  // Fetch display names for requesting users
  const claimRequests = await Promise.all(
    (rawClaimRequests || []).map(async (cr: any) => {
      const { data: rp } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', cr.requesting_user_id)
        .maybeSingle()
      return {
        ...cr,
        requester: { display_name: rp?.display_name || null },
      }
    })
  )

  const { data: members } = await supabase
    .from('members')
    .select('*, member_scores(overall_score, rally_leader_score, joiner_score), member_combat_stats(troop_type_primary)')
    .eq('alliance_id', params.id)
    .order('power', { ascending: false })

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}`, href: `/alliances/${params.id}` },
    { label: 'Members' },
  ]

  const allianceName = `[${alliance.tag}] ${alliance.name}`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-amber-500" size={24} />
          Members — {allianceName}
          {canManage && (pendingRequests?.length || 0) > 0 && (
            <Badge variant="amber">{pendingRequests.length} pending</Badge>
          )}
        </h1>
        {canManage && (
          <div className="flex items-center gap-2">
            <ImportMembersButton allianceId={params.id} />
            <AddMemberButton allianceId={params.id} />
          </div>
        )}
      </div>

      {canManage && <PendingProfileRequests requests={annotatedPendingRequests} allianceId={params.id} currentUserId={profile?.id} />}
      {canManage && <PendingClaimRequests requests={claimRequests || []} />}

      <Card>
        <CardContent className="pt-4">
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-2 pr-4">Player</th>
                  <th className="text-right py-2 pr-4">Power</th>
                  <th className="text-right py-2 pr-4">Troops</th>
                  <th className="text-right py-2 pr-4">March</th>
                  <th className="text-right py-2 pr-4">Rally Cap</th>
                  <th className="text-left py-2 pr-4">Troop Type</th>
                  <th className="text-right py-2 pr-4">Score</th>
                  {canManage && <th className="py-2 text-center">Link</th>}
                  {canManage && <th className="py-2 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members?.map(m => {
                  const score = (m.member_scores as any)?.[0]?.overall_score ?? 0
                  const troopType = (m.member_combat_stats as any)?.[0]?.troop_type_primary
                  return (
                    <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar
                            gameId={m.game_id}
                            avatarUrl={freshAvatar(m)}
                            playerName={m.player_name}
                            sizeClass="w-7 h-7"
                          />
                          <Link href={`/alliances/${params.id}/members/${m.id}`} className="text-amber-400 hover:text-amber-300 font-medium">
                            {m.player_name}
                          </Link>
                        </div>
                      </td>
                      <td className="text-right py-2 pr-4 text-slate-300">{formatPower(m.power)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.troop_count)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.march_size)}</td>
                      <td className="text-right py-2 pr-4 text-slate-400">{formatPower(m.rally_capacity)}</td>
                      <td className="py-2 pr-4">
                        {troopType && (
                          <Badge variant={troopType === 'infantry' ? 'red' : troopType === 'cavalry' ? 'blue' : troopType === 'archer' ? 'green' : 'default'}>
                            {troopType}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2 pr-4 font-mono text-slate-300">{score.toFixed(1)}</td>
                      {canManage && (
                        <td className="py-2 text-center">
                          <CopyTokenButton token={m.access_token} />
                        </td>
                      )}
                      {canManage && (
                        <td className="py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Remove from alliance (R4/R5/admin) — keeps record intact */}
                            <RemoveMemberButton
                              memberId={m.id}
                              playerName={m.player_name}
                              allianceName={allianceName}
                              mode="remove"
                            />
                            {/* Delete profile permanently — system_admin only */}
                            {isAdmin && (
                              <RemoveMemberButton
                                memberId={m.id}
                                playerName={m.player_name}
                                allianceName={allianceName}
                                mode="delete"
                              />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(!members || members.length === 0) && (
              <p className="text-slate-400 text-sm py-6 text-center">No members yet. Add members to get started.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
