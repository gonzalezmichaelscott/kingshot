import { redirect } from 'next/navigation'

export type UserRole = 'system_admin' | 'kingdom_leader' | 'r5' | 'r4' | 'member' | null

export function canManageAlliance(role: UserRole) {
  return ['system_admin', 'r5', 'r4'].includes(role || '')
}

export function canViewAlliance(role: UserRole, profileAllianceId: string | null | undefined, targetAllianceId: string) {
  if (role === 'system_admin' || role === 'kingdom_leader') return true
  return profileAllianceId === targetAllianceId
}

/** Fetches the current user + profile, redirects if not authenticated or unauthorized. */
export async function requireAllianceAccess(supabase: any, allianceId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!canViewAlliance(profile?.role, profile?.alliance_id, allianceId)) {
    redirect('/dashboard')
  }

  return { user, profile }
}
