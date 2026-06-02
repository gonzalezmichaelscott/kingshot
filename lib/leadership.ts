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
