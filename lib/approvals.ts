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
