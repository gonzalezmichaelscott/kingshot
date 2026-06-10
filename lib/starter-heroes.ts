/**
 * Every Kingshot account starts with the same 12 heroes. Seeding them onto each
 * member profile means members only need to update levels/stars/skills instead
 * of adding each hero by hand.
 *
 * Seeding is strictly additive: rows are inserted with `ignoreDuplicates` on the
 * (member_id, hero_id) unique key, so anything a player already entered —
 * levels, stars, widgets, skills — is never modified or overwritten.
 */
export const STARTER_HERO_NAMES = [
  'Fahd',
  'Amane',
  'Seth',
  'Edwin',
  'Forrest',
  'Olive',
  'Yeonwoo',
  'Gordon',
  'Quinn',
  'Chenko',
  'Howard',
  'Diana',
]

/**
 * Insert the starter heroes (at default level 1 / 0 stars) for the given members,
 * skipping any hero a member already has. Never throws — member creation must
 * not fail because seeding hiccuped.
 */
export async function seedStarterHeroes(svc: any, memberIds: string[]): Promise<void> {
  const ids = (memberIds || []).filter(Boolean)
  if (ids.length === 0) return
  try {
    const { data: heroes, error: heroErr } = await svc
      .from('heroes')
      .select('id, name')
      .in('name', STARTER_HERO_NAMES)
    if (heroErr || !heroes?.length) {
      if (heroErr) console.error('[StarterHeroes] hero lookup failed:', heroErr.message)
      return
    }
    const rows = ids.flatMap((memberId: string) =>
      heroes.map((h: any) => ({ member_id: memberId, hero_id: h.id }))
    )
    const { error } = await svc
      .from('member_heroes')
      .upsert(rows, { onConflict: 'member_id,hero_id', ignoreDuplicates: true })
    if (error) console.error('[StarterHeroes] seed failed:', error.message)
  } catch (err: any) {
    console.error('[StarterHeroes] seed failed:', err?.message || err)
  }
}
