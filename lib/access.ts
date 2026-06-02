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
 * Roles an actor is allowed to PROMOTE a member to directly (instant), within
 * their own alliance.
 * - system_admin: any role, any alliance
 * - r5: up to R5 (can promote anyone up to and including R5)
 * - r4: up to R4 (cannot promote to R5)
 * - r3 and below: no promotion access at all
 */
export function assignableRoles(actorRole: UserRole): string[] {
  if (actorRole === 'system_admin') return ['r1', 'r2', 'r3', 'r4', 'r5']
  if (actorRole === 'r5') return ['r1', 'r2', 'r3', 'r4', 'r5']
  if (actorRole === 'r4') return ['r1', 'r2', 'r3', 'r4']
  return []
}

export function canAssignRole(actorRole: UserRole, targetRole: string) {
  return assignableRoles(actorRole).includes(targetRole)
}

/** Elevated ranks whose join/rank requests need an R5 (or System Admin fallback). */
export const ELEVATED_REQUEST_ROLES = ['r4', 'r5'] as const

export function isElevatedRequestRole(role: string) {
  return role === 'r4' || role === 'r5'
}

/**
 * Whether a pending profile (join/rank) request must fall back to System Admin.
 * - r4/r5 requests fall back to admin ONLY when the alliance has no existing R5.
 * - r1/r2/r3 requests are always handled by the alliance's R4/R5 (never admin-only).
 */
export function profileRequestNeedsAdmin(requestedRole: string, allianceHasR5: boolean): boolean {
  if (isElevatedRequestRole(requestedRole)) return !allianceHasR5
  return false
}

/**
 * Whether `actorRole` may approve/reject a profile request, given the requested
 * role, whether the actor belongs to the request's alliance, and whether that
 * alliance currently has an R5.
 *
 * - System Admin: always.
 * - r4/r5 requests: only an R5 of the same alliance, and only while an R5 exists
 *   (otherwise it has fallen back to System Admin).
 * - r1/r2/r3 requests: any R4 or R5 of the same alliance.
 */
export function canApproveProfileRequest(
  actorRole: UserRole,
  requestedRole: string,
  sameAlliance: boolean,
  allianceHasR5: boolean
): boolean {
  if (actorRole === 'system_admin') return true
  if (!sameAlliance) return false
  if (isElevatedRequestRole(requestedRole)) {
    return allianceHasR5 && actorRole === 'r5'
  }
  return actorRole === 'r4' || actorRole === 'r5'
}

/**
 * Which requested-role values an alliance leader should see in their Members
 * page approval queue. R5 sees elevated (R4/R5) requests too; R4 sees only R1-R3.
 */
export function visibleRequestRolesFor(viewerRole: UserRole): string[] {
  if (viewerRole === 'r5' || viewerRole === 'system_admin') {
    return ['r1', 'r2', 'r3', 'r4', 'r5']
  }
  if (viewerRole === 'r4') return ['r1', 'r2', 'r3']
  return []
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
