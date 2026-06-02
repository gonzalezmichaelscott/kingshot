// @ts-nocheck
/**
 * Shared logic for carrying a player's data from one member record to another
 * when they change alliances or move to a different kingdom/server.
 *
 * Used by:
 *  - /api/profile-claim/approve  (Feature 1: auto-transfer when a claim at a new
 *    alliance is approved and the user already had a profile elsewhere)
 *  - /api/member/transfer        (Feature 2: self-service kingdom/alliance change)
 *
 * What carries over:
 *   power, troop_count, march_size, rally_capacity, timezone, troop_data,
 *   preferred_language, kvk_willing_to_move, all member_heroes,
 *   member_combat_stats, member_scores.
 *
 * What does NOT carry over (intentionally stays with the old alliance):
 *   event history / availability, chat messages, assignment history.
 */

// Scalar stat fields copied straight across.
const STAT_FIELDS = [
  'power',
  'troop_count',
  'march_size',
  'rally_capacity',
  'timezone',
  'troop_data',
  'preferred_language',
  'kvk_willing_to_move',
] as const

/**
 * Copy all transferable data from `fromMemberId` onto `toMemberId`.
 * Does NOT touch alliance/link/active flags — see `transferMember` for the full
 * move (which also marks the old record inactive).
 */
export async function copyMemberData(svc: any, fromMemberId: string, toMemberId: string) {
  const now = new Date().toISOString()

  // 1) Scalar stats + jsonb troop_data
  const { data: from } = await svc
    .from('members')
    .select(STAT_FIELDS.join(', '))
    .eq('id', fromMemberId)
    .maybeSingle()

  if (!from) return

  const statPayload: Record<string, any> = { updated_at: now }
  for (const f of STAT_FIELDS) {
    if (from[f] !== undefined && from[f] !== null) statPayload[f] = from[f]
  }
  await svc.from('members').update(statPayload).eq('id', toMemberId)

  // 2) Hero roster — upsert on (member_id, hero_id) so it merges cleanly even if
  //    the destination already had some heroes set.
  const { data: heroes } = await svc
    .from('member_heroes')
    .select('hero_id, hero_level, star_level, widget_level, expedition_skill_levels, is_primary')
    .eq('member_id', fromMemberId)

  if (heroes && heroes.length) {
    const rows = heroes.map((h: any) => ({
      member_id: toMemberId,
      hero_id: h.hero_id,
      hero_level: h.hero_level,
      star_level: h.star_level,
      widget_level: h.widget_level,
      expedition_skill_levels: h.expedition_skill_levels,
      is_primary: h.is_primary,
      updated_at: now,
    }))
    await svc.from('member_heroes').upsert(rows, { onConflict: 'member_id,hero_id' })
  }

  // 3) Combat stats — single row per member (replace any existing destination row)
  const { data: combat } = await svc
    .from('member_combat_stats')
    .select('*')
    .eq('member_id', fromMemberId)
    .maybeSingle()

  if (combat) {
    const { id, member_id, ...rest } = combat
    await svc.from('member_combat_stats').delete().eq('member_id', toMemberId)
    await svc.from('member_combat_stats').insert({ ...rest, member_id: toMemberId, updated_at: now })
  }

  // 4) Member scores — unique per member (replace any existing destination row)
  const { data: score } = await svc
    .from('member_scores')
    .select('*')
    .eq('member_id', fromMemberId)
    .maybeSingle()

  if (score) {
    const { id, member_id, ...rest } = score
    await svc.from('member_scores').delete().eq('member_id', toMemberId)
    await svc.from('member_scores').insert({ ...rest, member_id: toMemberId })
  }
}

/**
 * Full move: copy all data from the old member record to the new one, then mark
 * the old record inactive and point it at the new record (so old self-service
 * links can redirect). Records the new member's previous alliance for the
 * "your data was transferred" notice.
 *
 * @returns the previous alliance id (or null if no source record)
 */
export async function transferMember(
  svc: any,
  oldMemberId: string,
  newMemberId: string,
): Promise<string | null> {
  const now = new Date().toISOString()

  const { data: oldMember } = await svc
    .from('members')
    .select('id, alliance_id')
    .eq('id', oldMemberId)
    .maybeSingle()

  if (!oldMember) return null

  await copyMemberData(svc, oldMemberId, newMemberId)

  // Mark the old record inactive and link it forward.
  await svc
    .from('members')
    .update({ is_active: false, transferred_to: newMemberId, updated_at: now })
    .eq('id', oldMemberId)

  // Stamp the new record with where the player came from.
  await svc
    .from('members')
    .update({ previous_alliance_id: oldMember.alliance_id, updated_at: now })
    .eq('id', newMemberId)

  return oldMember.alliance_id
}

/**
 * Find the user's most recent ACTIVE member record in an alliance other than
 * `excludeAllianceId`. Used to detect a "previous profile" to transfer from.
 */
export async function findPreviousMember(
  svc: any,
  userId: string,
  excludeMemberId: string,
) {
  const { data } = await svc
    .from('members')
    .select('id, alliance_id')
    .eq('linked_user_id', userId)
    .eq('is_active', true)
    .neq('id', excludeMemberId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * Follow the transferred_to chain to the final active record's access token.
 * Guards against cycles with a hop cap.
 */
export async function resolveTransferTarget(svc: any, startMemberId: string) {
  let currentId = startMemberId
  let token: string | null = null
  for (let i = 0; i < 10; i++) {
    const { data } = await svc
      .from('members')
      .select('id, access_token, transferred_to')
      .eq('id', currentId)
      .maybeSingle()
    if (!data || !data.transferred_to) {
      token = data?.access_token ?? null
      break
    }
    currentId = data.transferred_to
    token = data.access_token // will be overwritten on next loop unless terminal
  }
  // Re-read the terminal record's token
  const { data: terminal } = await svc
    .from('members')
    .select('access_token')
    .eq('id', currentId)
    .maybeSingle()
  return terminal?.access_token ?? token
}
