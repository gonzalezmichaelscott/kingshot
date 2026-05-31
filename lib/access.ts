// @ts-nocheck
import { redirect } from 'next/navigation'

export type UserRole = 'system_admin' | 'r5' | 'r4' | 'r3' | 'r2' | 'r1' | null

// Roles that can access the Alliance Hub backend (member mgmt, events, analytics…)
export const BACKEND_ROLES = ['system_admin', 'r5', 'r4'] as const
// Member-level roles (own profile + assignments only, no backend)
export const MEMBER_ROLES = ['r3', 'r2', 'r1'] as const

export function isBackendRole(role: UserRole) {
  return BACKEND_ROLES.includes(role as any)
}

export function isMemberRole(role: UserRole) {
  return MEMBER_ROLES.includes(role as any)
}

/** R4/R5/system_admin can manage members, events, squads within their alliance. */
export function canManageAlliance(role: UserRole) {
  return isBackendRole(role)
}

/** Visibility of a specific alliance's backend. */
export function canViewAlliance(role: UserRole, profileAllianceId: string | null | undefined, targetAllianceId: string) {
  if (role === 'system_admin') return true
  return isBackendRole(role) && profileAllianceId === targetAllianceId
}

/**
 * Roles an actor is allowed to ASSIGN to a member directly (instant).
 * - system_admin: any role including r5
 * - r5: r1-r4 (NOT r5 — that needs admin approval)
 * - r4: r1-r3 only
 * Requesting r5 always routes through the System Admin approval queue.
 */
export function assignableRoles(actorRole: UserRole): string[] {
  if (actorRole === 'system_admin') return ['r1', 'r2', 'r3', 'r4', 'r5']
  if (actorRole === 'r5') return ['r1', 'r2', 'r3', 'r4']
  if (actorRole === 'r4') return ['r1', 'r2', 'r3']
  return []
}

export function canAssignRole(actorRole: UserRole, targetRole: string) {
  return assignableRoles(actorRole).includes(targetRole)
}

/**
 * Who approves a profile request for the given requested role.
 * - r1/r2/r3 → the alliance's r4/r5 (or system_admin)
 * - r4/r5    → system_admin only
 */
export function profileRequestApprover(requestedRole: string): 'alliance' | 'system_admin' {
  return requestedRole === 'r4' || requestedRole === 'r5' ? 'system_admin' : 'alliance'
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  if (role === 'system_admin') return 'System Admin'
  return role.toUpperCase()
}

/**
 * Fetch the current user + profile, redirecting if not authenticated or not a
 * backend role for this alliance. Used by all /alliances/[id]/* backend pages.
 */
export async function requireAllianceAccess(supabase: any, allianceId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.alliance_id && !isBackendRole(profile?.role)) {
    redirect('/onboarding')
  }

  if (!canViewAlliance(profile?.role, profile?.alliance_id, allianceId)) {
    redirect('/dashboard')
  }

  return { user, profile }
}
