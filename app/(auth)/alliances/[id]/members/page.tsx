// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { annotateExistingProfiles } from '@/lib/approvals'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { AddMemberButton } from '@/components/members/AddMemberButton'
import { PendingProfileRequests } from '@/components/members/PendingProfileRequests'
import { PendingClaimRequests } from '@/components/members/PendingClaimRequests'
import { ImportMembersButton } from '@/components/members/ImportMembersButton'
import { requireAllianceAccess, canManageAlliance, visibleRequestRolesFor } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { MembersTable } from '@/components/members/MembersTable'

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
    .select('*')
    .eq('alliance_id', params.id)
    // Only active roster members — deactivated/transferred records (is_active =
    // false), including any soft-deleted duplicates, must not appear in the list.
    .eq('is_active', true)
    .order('power', { ascending: false })

  // The active KVK event for THIS alliance (R4/R5/admin only): the most recent
  // non-completed Castle Battle event that has not yet ended. When one exists, the
  // members table shows a KVK attendance toggle column.
  const svc = createServiceClient()
  let kvkEventId: string | null = null
  if (canManage) {
    const { data: kvkType } = await svc.from('event_types').select('id').eq('slug', 'kvk_castle_battle').single()
    if (kvkType) {
      const { data: evs } = await svc
        .from('events')
        .select('id, status, battle_end_utc')
        .eq('alliance_id', params.id)
        .eq('event_type_id', kvkType.id)
        .order('battle_start_utc', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      const ev = (evs || [])[0]
      const ended = ev?.battle_end_utc && new Date(ev.battle_end_utc) < new Date()
      if (ev && ev.status !== 'completed' && !ended) kvkEventId = ev.id
    }
  }

  // Current attendance for the active KVK event, keyed by member id.
  const attendanceMap: Record<string, boolean> = {}
  if (kvkEventId) {
    const { data: avail } = await svc
      .from('event_availability')
      .select('member_id, will_attend')
      .eq('event_id', kvkEventId)
    for (const a of avail || []) attendanceMap[a.member_id] = !!a.will_attend
  }

  // The single global TrueGold level for a member (max across troop types).
  const readTgLevel = (td: any): number => {
    if (!td || typeof td !== 'object') return 0
    let max = 0
    for (const type of ['infantry', 'cavalry', 'archer']) {
      const tg = Number(td?.[type]?.tg_level)
      if (!isNaN(tg) && tg > max) max = tg
    }
    return max
  }

  // Shape rows for the client table: resolve the cached avatar, derive the global
  // TrueGold level, and flag current KVK attendance.
  const membersForList = (members || []).map((m: any) => ({
    ...m,
    avatarUrl: freshAvatar(m),
    tgLevel: readTgLevel(m.troop_data),
    kvkAttending: !!attendanceMap[m.id],
  }))

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
            <AddMemberButton allianceId={params.id} actorRole={profile?.role} />
          </div>
        )}
      </div>

      {canManage && <PendingProfileRequests requests={annotatedPendingRequests} allianceId={params.id} currentUserId={profile?.id} />}
      {canManage && <PendingClaimRequests requests={claimRequests || []} />}

      <MembersTable
        allianceId={params.id}
        allianceName={allianceName}
        canManage={canManage}
        isAdmin={isAdmin}
        kvkEventId={kvkEventId}
        initialMembers={membersForList}
      />
    </div>
  )
}
