// @ts-nocheck
// Server-safe leadership lookups. These take an already-constructed Supabase
// client (service or authed) so this module pulls in no server-only imports and
// is safe to import from anywhere.

/** Does the given alliance currently have at least one R5? */
export async function allianceHasR5(supabase: any, allianceId: string | null | undefined): Promise<boolean> {
  if (!allianceId) return false
  const { count } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('alliance_id', allianceId)
    .eq('role', 'r5')
  return (count || 0) > 0
}

/**
 * User ids eligible to approve a profile (join/rank) request, mirroring the
 * routing rules:
 *  - r1/r2/r3 → all R4/R5 of the alliance
 *  - r4/r5    → all R5 of the alliance if one exists, else all System Admins
 */
export async function eligibleApproverUserIds(
  supabase: any,
  allianceId: string | null | undefined,
  requestedRole: string
): Promise<string[]> {
  const elevated = requestedRole === 'r4' || requestedRole === 'r5'
  if (elevated) {
    const hasR5 = await allianceHasR5(supabase, allianceId)
    if (hasR5) {
      const { data } = await supabase
        .from('user_profiles').select('id')
        .eq('alliance_id', allianceId).eq('role', 'r5')
      return (data || []).map((d: any) => d.id)
    }
    const { data } = await supabase
      .from('user_profiles').select('id').eq('role', 'system_admin')
    return (data || []).map((d: any) => d.id)
  }
  if (!allianceId) return []
  const { data } = await supabase
    .from('user_profiles').select('id')
    .eq('alliance_id', allianceId).in('role', ['r4', 'r5'])
  return (data || []).map((d: any) => d.id)
}

/** Subset of the given alliance ids that currently have at least one R5. */
export async function alliancesWithR5(
  supabase: any,
  allianceIds: string[]
): Promise<Set<string>> {
  const ids = Array.from(new Set((allianceIds || []).filter(Boolean)))
  if (ids.length === 0) return new Set()
  const { data } = await supabase
    .from('user_profiles')
    .select('alliance_id')
    .eq('role', 'r5')
    .in('alliance_id', ids)
  return new Set((data || []).map((d: any) => d.alliance_id).filter(Boolean))
}
