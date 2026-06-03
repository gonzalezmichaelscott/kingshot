// @ts-nocheck
// Server-safe loader for a user's approval queues. Takes an authed Supabase
// client (RLS-scoped) so it works from both pages and API routes.
import { alliancesWithR5 } from '@/lib/leadership'

export interface ApprovalQueues {
  joinRequests: any[]        // R1/R2/R3 join requests for the alliance
  leadershipRequests: any[]  // R4/R5 requests (alliance R5, or admin fallback)
  kingdomRequests: any[]     // new-kingdom creation (admin only)
  allianceRequests: any[]    // new-alliance creation (admin only)
  count: number
}

/**
 * Given a SERVICE client and a list of auth user ids, return the set of users
 * who already own a member record with carried-over stats (a "rejoin"). Uses the
 * service client because the existing record lives in a different alliance (or
 * none) and would be hidden from an alliance-scoped authed client by RLS.
 */
export async function usersWithExistingProfiles(svc: any, userIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (ids.length === 0) return new Set()
  const { data } = await svc
    .from('members')
    .select('linked_user_id')
    .in('linked_user_id', ids)
  const set = new Set<string>()
  for (const m of data || []) if (m.linked_user_id) set.add(m.linked_user_id)
  return set
}

/** Annotate profile requests with `has_existing_profile` (rejoin indicator). */
export async function annotateExistingProfiles(svc: any, requests: any[]): Promise<any[]> {
  if (!requests || requests.length === 0) return requests || []
  const set = await usersWithExistingProfiles(svc, requests.map((r: any) => r.user_id))
  return requests.map((r: any) => ({ ...r, has_existing_profile: set.has(r.user_id) }))
}

export async function loadApprovalQueues(supabase: any, profile: any): Promise<ApprovalQueues> {
  const role = profile?.role
  const allianceId = profile?.alliance_id
  const isAdmin = role === 'system_admin'

  let joinRequests: any[] = []
  let leadershipRequests: any[] = []
  let kingdomRequests: any[] = []
  let allianceRequests: any[] = []

  // Alliance leaders: their alliance's queues.
  if ((role === 'r4' || role === 'r5') && allianceId) {
    const { data: joins } = await supabase
      .from('profile_requests')
      .select('*, alliances(name, tag)')
      .eq('alliance_id', allianceId)
      .eq('status', 'pending')
      .in('requested_role', ['r1', 'r2', 'r3'])
      .order('created_at', { ascending: false })
    joinRequests = joins || []

    // Only R5 handles elevated R4/R5 requests within the alliance.
    if (role === 'r5') {
      const { data: leads } = await supabase
        .from('profile_requests')
        .select('*, alliances(name, tag)')
        .eq('alliance_id', allianceId)
        .eq('status', 'pending')
        .in('requested_role', ['r4', 'r5'])
        .order('created_at', { ascending: false })
      leadershipRequests = leads || []
    }
  }

  // System Admin: fallback elevated requests (alliances without an R5) + creations.
  if (isAdmin) {
    const { data: rawElevated } = await supabase
      .from('profile_requests')
      .select('*, alliances(name, tag)')
      .eq('status', 'pending')
      .in('requested_role', ['r4', 'r5'])
      .order('created_at', { ascending: false })
    const r5set = await alliancesWithR5(supabase, (rawElevated || []).map((r: any) => r.alliance_id))
    leadershipRequests = (rawElevated || []).filter((r: any) => !r5set.has(r.alliance_id))

    const { data: kReqs } = await supabase
      .from('kingdom_creation_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    kingdomRequests = (kReqs || []).filter((r: any) => r.request_type === 'new_kingdom')
    allianceRequests = (kReqs || []).filter((r: any) => r.request_type === 'new_alliance')
  }

  // Attach each requester's current role to leadership requests.
  const userIds = leadershipRequests.map((r: any) => r.user_id)
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from('user_profiles').select('id, role').in('id', userIds)
    const map = Object.fromEntries((profs || []).map((p: any) => [p.id, p.role]))
    leadershipRequests = leadershipRequests.map((r: any) => ({ ...r, current_role: map[r.user_id] || null }))
  }

  const count =
    joinRequests.length + leadershipRequests.length + kingdomRequests.length + allianceRequests.length
  return { joinRequests, leadershipRequests, kingdomRequests, allianceRequests, count }
}
