// @ts-nocheck
// Helpers for multi-profile support (FEATURE 1). A single auth user can own
// several member records (alts) across alliances; `members.linked_user_id` is the
// authoritative ownership link, mirrored into `user_member_profiles` for listing.

export const MAX_PROFILES_PER_ACCOUNT = 5

export interface UserProfileEntry {
  member_id: string
  player_name: string
  game_id: string | null
  avatar_url: string | null
  alliance_id: string | null
  alliance_tag: string | null
  alliance_name: string | null
  role: string | null
  is_active: boolean
  is_active_profile: boolean
}

/**
 * Mirror every member a user owns (linked_user_id = userId, active, not retired)
 * into user_member_profiles. Idempotent. Keeps the switcher list and the
 * switch-route ownership mirror consistent for legacy single-profile users too.
 */
export async function ensureUserProfileLinks(svc: any, userId: string): Promise<void> {
  const { data: members } = await svc
    .from('members')
    .select('id')
    .eq('linked_user_id', userId)
    .eq('is_active', true)
    .is('transferred_to', null)
  const rows = (members || []).map((m: any) => ({ user_id: userId, member_id: m.id }))
  if (rows.length === 0) return
  // ignoreDuplicates so existing links (and their is_active_profile flag) are kept.
  await svc.from('user_member_profiles').upsert(rows, { onConflict: 'user_id,member_id', ignoreDuplicates: true })
}

/**
 * The list of profiles a user can switch between, with alliance + role context.
 * `activeMemberId` / `currentAllianceId` come from user_profiles to mark which
 * one is active (falling back to the alliance match for legacy users).
 */
export async function listUserProfiles(
  svc: any,
  userId: string,
  activeMemberId: string | null,
  currentAllianceId: string | null
): Promise<UserProfileEntry[]> {
  const { data: members } = await svc
    .from('members')
    .select('id, player_name, game_id, avatar_url, alliance_id, role, is_active, alliances!members_alliance_id_fkey(name, tag)')
    .eq('linked_user_id', userId)
    .eq('is_active', true)
    .is('transferred_to', null)
    .order('updated_at', { ascending: false })

  const list = (members || []).map((m: any) => ({
    member_id: m.id,
    player_name: m.player_name,
    game_id: m.game_id,
    avatar_url: m.avatar_url || null,
    alliance_id: m.alliance_id,
    alliance_tag: m.alliances?.tag || null,
    alliance_name: m.alliances?.name || null,
    role: m.role || null,
    is_active: !!m.is_active,
    is_active_profile: false,
  }))

  if (list.length === 0) return list

  // Determine the active profile: explicit active_member_id, else the member in
  // the user's current alliance, else the most recently updated.
  let activeIdx = activeMemberId ? list.findIndex(p => p.member_id === activeMemberId) : -1
  if (activeIdx < 0 && currentAllianceId) {
    activeIdx = list.findIndex(p => p.alliance_id === currentAllianceId)
  }
  if (activeIdx < 0) activeIdx = 0
  list[activeIdx].is_active_profile = true
  return list
}
