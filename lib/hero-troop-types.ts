/**
 * Canonical hero troop-type corrections.
 *
 * The heroes table is the source of truth for troop_type, but these heroes were
 * misclassified in early data loads (fixed in migration
 * 20260609_fix_hero_troop_types.sql). This map is the verified classification —
 * apply it over any hero row via resolveTroopType() so plans and prompts stay
 * correct even against a stale database.
 */
export type TroopType = 'infantry' | 'cavalry' | 'archer' | 'all'

export const HERO_TROOP_TYPE_OVERRIDES: Record<string, TroopType> = {
  Hilde: 'cavalry',
  Zoe: 'infantry',
  Fahd: 'cavalry',
  Amane: 'archer',
  Gordon: 'cavalry',
  Quinn: 'archer',
  Howard: 'infantry',
  Diana: 'archer',
  Saul: 'archer',
}

/** Troop type for a hero row, preferring the verified override over the DB value. */
export function resolveTroopType(hero: { name?: string | null; troop_type?: string | null } | null | undefined): TroopType | null {
  if (!hero?.name) return (hero?.troop_type as TroopType) || null
  return HERO_TROOP_TYPE_OVERRIDES[hero.name] || (hero.troop_type as TroopType) || null
}

/**
 * MARCH RULE — a squad/march may contain at most ONE hero of each troop type.
 * Checks a squad of hero names against the known troop types; returns the
 * duplicated type if two known heroes share one, else null. Heroes whose type
 * is unknown client-side are skipped (enforced server-side at generation).
 */
export function findSquadTypeConflict(
  heroNames: string[],
  typeLookup: (name: string) => TroopType | null = (name) => HERO_TROOP_TYPE_OVERRIDES[name] || null
): TroopType | null {
  const seen = new Set<TroopType>()
  for (const name of heroNames) {
    const type = typeLookup(name)
    if (!type || type === 'all') continue
    if (seen.has(type)) return type
    seen.add(type)
  }
  return null
}
