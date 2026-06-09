// @ts-nocheck
/**
 * KINGSHOT COMBAT SCORING ENGINE
 *
 * Verified damage formula (~100% accuracy per community research):
 * Kills = √Troops × (Attack × Lethality) / (Enemy Defense × Enemy Health) × SkillMod
 *
 * Key rules:
 * 1. Attack and Lethality are EQUAL — they multiply together. Balance both.
 * 2. Boost whichever stat is LOWER for bigger gains.
 * 3. Troop count scales with SQUARE ROOT — doubling troops does not double damage.
 * 4. SkillMod (hero expedition skills) has the BIGGEST influence on damage.
 * 5. Different effect_op codes MULTIPLY — hero diversity matters enormously.
 * 6. Same effect_op codes ADD — diminishing returns on duplicate heroes.
 * 7. Widget boosts are MULTIPLICATIVE — critical for rally/garrison leaders.
 * 8. JOINERS: only the first expedition skill of the lead hero applies.
 * 9. LEADERS: all expedition skills from all 3 heroes apply.
 */

export interface ExpeditionSkill {
  slot: number
  name: string
  effect_op: number | string
  effect_type: string
  base_value: number
  is_joiner_skill?: boolean
  chance?: number
  requires_widget?: boolean
  notes?: string
}

export interface CombatStats {
  infantryAttack: number
  infantryDefense: number
  infantryHealth: number
  infantryLethality: number
  cavalryAttack: number
  cavalryDefense: number
  cavalryHealth: number
  cavalryLethality: number
  archerAttack: number
  archerDefense: number
  archerHealth: number
  archerLethality: number
}

/** Raw-ish member_heroes row joined with its hero. */
export interface MemberHero {
  hero?: {
    name?: string
    generation?: number
    troop_type?: string | null
    role?: string | null
    primary_role?: string | null
    has_widget?: boolean
    is_economy_hero?: boolean
    stat_bonuses?: Record<string, number> | null
    expedition_skills?: ExpeditionSkill[]
  } | null
  star_level?: number
  star_shards?: number
  widget_level?: number
  widget_unlocked?: boolean
  expedition_skill_levels?: Record<string, number>
}

// Back-compat alias for older imports
export type MemberHeroData = MemberHero

export type TroopData = Record<string, Record<string, number>>

export interface MemberProfile {
  id: string
  power: number
  troopCount: number
  marchSize: number
  rallyCapacity: number
  combatStats: CombatStats
  heroes: MemberHero[]
  primaryTroopType: 'infantry' | 'cavalry' | 'archer' | 'mixed'
  troopData?: TroopData | null
}

export interface RoleScores {
  rallyLeader: number
  joiner: number
  castle: number
  turretLeader: number
  turretJoiner: number
  garrison: number
  support: number
  // Back-compat fields mapped to fixed member_scores columns
  turret: number
  defender: number
  overall: number
}

/**
 * CORRECTED TROOP MODEL
 *
 * Troops exist only as standard tiers T1-T10. "Truegold" (TG) is NOT a tier — it
 * is a global stat multiplier (TG0-TG10) applied to ALL troops of a given type
 * once unlocked via Barracks/Range/Stable. A player cannot mix TG levels within a
 * troop type; the level applies to the whole pool.
 *
 * troop_data structure (per troop type):
 *   { t1..t10: count, tg_level: 0-10 }
 */

/** Raw power contribution per unit at each standard tier. */
export const TIER_POWER: Record<string, number> = {
  t1: 3, t2: 4, t3: 6, t4: 9, t5: 13,
  t6: 20, t7: 28, t8: 38, t9: 50, t10: 66,
}

/** Multiplicative stat bonus applied to the entire troop pool at each TG level. */
export const TG_MULTIPLIERS: Record<number, number> = {
  0: 1.0,   // No TG
  1: 1.15,
  2: 1.25,
  3: 1.40,  // TG3 also unlocks a special combat skill — significant power jump
  4: 1.55,
  5: 1.72,
  6: 1.92,
  7: 2.15,
  8: 2.40,
  9: 2.68,
  10: 3.0,
}

const TROOP_TYPE_KEYS = ['infantry', 'cavalry', 'archer'] as const
type TroopTypeKey = (typeof TROOP_TYPE_KEYS)[number]

/** Read a tier count tolerating legacy uppercase keys (T10) alongside t10. */
function readTier(typeData: any, tier: string): number {
  if (!typeData || typeof typeData !== 'object') return 0
  const v = typeData[tier] ?? typeData[tier.toUpperCase()]
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Effective strength of ONE troop type: sum of raw tier power, scaled by the
 * type's TG multiplier, with an extra skill bonus once the TG3 skill unlocks.
 */
function effectiveForType(typeData: any): number {
  if (!typeData || typeof typeData !== 'object') return 0
  const rawPower = Object.entries(TIER_POWER).reduce(
    (sum, [tier, power]) => sum + readTier(typeData, tier) * power,
    0
  )
  const tgLevel = Math.max(0, Math.min(10, Number(typeData.tg_level) || 0))
  const tgMultiplier = TG_MULTIPLIERS[tgLevel] ?? 1.0
  // TG3+ special skill bonus (Unyielding Shield / Assault Lance / Howling Wind)
  const skillBonus = tgLevel >= 3 ? 1.15 : 1.0
  return rawPower * tgMultiplier * skillBonus
}

/**
 * Effective troop strength. Pass a `troopType` for that type's strength, or omit
 * it to get the combined total across all three types. Use sqrt() of this value
 * in scoring formulas instead of raw troop_count.
 */
export function calculateEffectiveTroopStrength(
  troopData: TroopData | null | undefined,
  troopType?: TroopTypeKey
): number {
  if (!troopData) return 0
  if (troopType) return effectiveForType(troopData[troopType])
  return TROOP_TYPE_KEYS.reduce((sum, t) => sum + effectiveForType(troopData[t]), 0)
}

/**
 * Detect the primary troop type from per-type effective strength (TG-aware).
 * Returns 'mixed' when the top type is within 20% of the second-highest.
 */
export function detectPrimaryTroopType(
  troopData: TroopData | null | undefined
): 'infantry' | 'cavalry' | 'archer' | 'mixed' {
  if (!troopData) return 'mixed'
  const strengths: Record<string, number> = {
    infantry: calculateEffectiveTroopStrength(troopData, 'infantry'),
    cavalry: calculateEffectiveTroopStrength(troopData, 'cavalry'),
    archer: calculateEffectiveTroopStrength(troopData, 'archer'),
  }
  const sorted = Object.entries(strengths).sort((a, b) => b[1] - a[1])
  const [first, second] = sorted
  if (first[1] === 0) return 'mixed'
  if (second[1] / first[1] >= 0.8) return 'mixed'
  return first[0] as 'infantry' | 'cavalry' | 'archer'
}

export const EFFECT_OP_TYPES: Record<number, { name: string; category: string; reliable?: boolean }> = {
  101: { name: 'DamageUp_A', category: 'offense', reliable: true },
  102: { name: 'DamageUp_B', category: 'offense', reliable: true },
  103: { name: 'ChanceDamageUp', category: 'offense', reliable: false },
  104: { name: 'CritRate', category: 'offense', reliable: true },
  105: { name: 'RallyMultiplier', category: 'offense', reliable: true },
  111: { name: 'DamageReduction', category: 'defense', reliable: true },
  112: { name: 'DefenseUp', category: 'defense', reliable: true },
  113: { name: 'HealthUp', category: 'defense', reliable: true },
  200: { name: 'OppDamageUp', category: 'debuff_offensive', reliable: true },
  201: { name: 'OppDamageDown_A', category: 'debuff_defensive', reliable: true },
  202: { name: 'OppDamageDown_B', category: 'debuff_defensive', reliable: true },
  999: { name: 'NonCombat', category: 'utility', reliable: false },
}

/** Parse an effect_op which may be a number or a compound string like "102+112". */
export function parseEffectOp(op: number | string | undefined | null): number | null {
  if (op === undefined || op === null) return null
  if (typeof op === 'number') return op
  const first = String(op).split('+')[0].trim()
  const n = parseInt(first, 10)
  return Number.isNaN(n) ? null : n
}

/** The effect_op of a hero's joiner (slot 1) expedition skill. */
export function getFirstSkillEffectOp(skills?: ExpeditionSkill[]): number | null {
  if (!skills || skills.length === 0) return null
  const joiner = skills.find(s => s.is_joiner_skill) || skills.find(s => s.slot === 1) || skills[0]
  return parseEffectOp(joiner?.effect_op)
}

/** Reward heroes whose skills use flat/reliable effect_ops over chance-based ones. */
export function calculateReliabilityBonus(skills?: ExpeditionSkill[]): number {
  if (!skills || skills.length === 0) return 0
  let bonus = 0
  for (const s of skills) {
    const op = parseEffectOp(s.effect_op)
    if (op === null) continue
    const meta = EFFECT_OP_TYPES[op]
    if (meta?.reliable && op !== 999) bonus += 5
  }
  return bonus
}

/**
 * Get exact hero stat bonus percentage based on star level and shards.
 * These are verified Attack/Defense bonus values from the game.
 * Only matters for rally leaders (stat bonus applies to entire squad).
 * For joiners, only expedition skill levels matter (not stat bonus).
 */
export function getHeroStatBonus(
  statBonuses: Record<string, number> | null,
  starLevel: number,
  starShards: number
): number {
  if (!statBonuses) return 0
  if (starLevel >= 5) return statBonuses['max'] || 0
  const key = `${starLevel}_${starShards}`
  return statBonuses[key] || 0
}

/**
 * RALLY LEADER hero score — leaders use ALL expedition skills from ALL 3 heroes.
 * Uses each hero's exact Attack/Defense stat bonus (star/shard lookup) where
 * available; widget is multiplicative. Economy heroes contribute nothing.
 */
export function calculateLeaderHeroScore(heroes: MemberHero[]): number {
  if (!heroes || heroes.length === 0) return 0

  return heroes.reduce((total, mh) => {
    // Skip economy heroes entirely
    if (mh.hero?.is_economy_hero) return total

    const exactBonus = getHeroStatBonus(
      mh.hero?.stat_bonuses as Record<string, number> | null,
      mh.star_level || 0,
      mh.star_shards || 0
    )

    // Use exact stat bonus if available, fall back to generation estimate
    const statBonusScore = exactBonus > 0
      ? exactBonus * 2
      : (mh.hero?.generation || 1) * 18

    // Widget multiplier (multiplicative for leaders)
    const gen = mh.hero?.generation || 1
    const widgetMultiplier = mh.widget_unlocked
      ? 1 + ((mh.widget_level || 0) * 0.025 * (gen >= 7 ? 1.5 : gen >= 6 ? 1.3 : 1.0))
      : 1.0

    // All expedition skills count for leaders
    const skillLevels = (mh.expedition_skill_levels as Record<string, number>) || {}
    const skillBonus = Object.values(skillLevels).reduce((s, v) => s + (v as number) * 8, 0)

    return total + (statBonusScore + skillBonus) * widgetMultiplier
  }, 0)
}

/**
 * RALLY JOINER hero score — only the FIRST expedition skill of the lead hero
 * applies. Economy heroes contribute nothing.
 */
export function calculateJoinerHeroScore(leadHero: MemberHero | null): number {
  if (!leadHero) return 0
  if (leadHero.hero?.is_economy_hero) return 0

  const exactBonus = getHeroStatBonus(
    leadHero.hero?.stat_bonuses as Record<string, number> | null,
    leadHero.star_level || 0,
    leadHero.star_shards || 0
  )

  const statBonusScore = exactBonus > 0
    ? exactBonus * 1.5
    : (leadHero.hero?.generation || 1) * 10

  // ABSOLUTE RULE (FIX 1): widgets provide ZERO benefit to joiners — they only
  // activate for rally/garrison LEADERS. Widget level must NEVER be factored into
  // the joiner score. (It is intentionally omitted here.)

  // Only first expedition skill for joiners
  const skillLevels = (leadHero.expedition_skill_levels as Record<string, number>) || {}
  const skillKeys = Object.keys(skillLevels)
  const firstSkillBonus = skillKeys.length > 0 ? (skillLevels[skillKeys[0]] || 0) * 20 : 0

  return statBonusScore + firstSkillBonus
}

/**
 * JOINER DIVERSITY BONUS — different effect_op codes multiply together.
 * 2x Chenko (101) + 2x Amane (102) beats 4x Chenko by ~12.5%.
 */
export function calculateJoinerDiversityBonus(joiners: MemberHero[]): number {
  if (!joiners || joiners.length < 2) return 0
  const ops = joiners.map(j => getFirstSkillEffectOp(j.hero?.expedition_skills))
  const unique = new Set(ops.filter(op => op !== null && op !== 999))
  if (unique.size >= 3) return 30
  if (unique.size >= 2) return 15
  return 0
}

/** Troop counter: Infantry > Cavalry > Archer > Infantry. */
export function getTroopCounterBonus(attackerType: string, defenderType: string): number {
  const counters: Record<string, string> = {
    infantry: 'cavalry',
    cavalry: 'archer',
    archer: 'infantry',
  }
  return counters[attackerType] === defenderType ? 0.35 : 0
}

/**
 * Back-compat hero score (single number). Older callers (ai-planner display,
 * recalculate route) import this. Mirrors the leader hero score.
 */
export function calculateHeroScore(heroes: MemberHero[]): number {
  return calculateLeaderHeroScore(heroes)
}

/**
 * Full role-score calculation. Weights come from event_types.scoring_weights.
 *
 * @param rallyLeaderTroopType - When scoring joiners for a specific rally, pass the
 *   leader's primary troop type to apply the 15% match bonus / 10% mismatch penalty.
 */
export function calculateRoleScores(
  member: MemberProfile,
  scoringWeights: Record<string, Record<string, number>>,
  enemyTroopType?: string,
  rallyLeaderTroopType?: string
): RoleScores {
  const leaderHeroScore = calculateLeaderHeroScore(member.heroes)
  const joinerHeroScore = calculateJoinerHeroScore(member.heroes?.[0] || null)

  const powerNorm = (member.power || 0) / 1_000_000
  const marchNorm = (member.marchSize || 0) / 100_000
  const rallyNorm = (member.rallyCapacity || 0) / 1_000_000

  // Use effective troop strength when troop_data is available; fall back to raw count.
  const effectiveStrength = member.troopData
    ? calculateEffectiveTroopStrength(member.troopData)
    : member.troopCount || 0
  const troopNorm = Math.sqrt(effectiveStrength) / 100

  const leaderHeroNorm = leaderHeroScore / 200
  const joinerHeroNorm = joinerHeroScore / 100

  const stats = member.combatStats || ({} as CombatStats)
  const attackScore = ((stats.infantryAttack || 0) + (stats.cavalryAttack || 0) + (stats.archerAttack || 0)) / 3_000_000
  const lethalityScore = ((stats.infantryLethality || 0) + (stats.cavalryLethality || 0) + (stats.archerLethality || 0)) / 3_000_000
  const defenseScore = ((stats.infantryDefense || 0) + (stats.cavalryDefense || 0) + (stats.archerDefense || 0)) / 3_000_000
  const healthScore = ((stats.infantryHealth || 0) + (stats.cavalryHealth || 0) + (stats.archerHealth || 0)) / 3_000_000

  // damage_product = sqrt(attack * lethality) — reflects the multiplicative formula
  const damageProductScore = Math.sqrt(Math.max(attackScore * lethalityScore, 0)) * 2

  const counterBonus = enemyTroopType
    ? getTroopCounterBonus(member.primaryTroopType || 'mixed', enemyTroopType)
    : 0

  const score = (role: string, heroNorm: number) => {
    const rw = scoringWeights[role] || {}
    return (
      powerNorm * (rw.power || 0) +
      marchNorm * (rw.march_size || 0) +
      rallyNorm * (rw.rally_capacity || 0) +
      troopNorm * (rw.troop_count || 0) +
      heroNorm * (rw.hero_score || 0) +
      damageProductScore * (rw.damage_product || 0) +
      attackScore * (rw.attack || 0) +
      lethalityScore * (rw.lethality || 0) +
      defenseScore * (rw.defense || 0) +
      healthScore * (rw.health || 0)
    ) * (1 + counterBonus)
  }

  // Troop type match bonus/penalty for joiners
  const troopTypeMult = rallyLeaderTroopType
    ? member.primaryTroopType === rallyLeaderTroopType ? 1.15
      : member.primaryTroopType === 'mixed' ? 1.0
      : 0.9
    : 1.0

  const rallyLeader = score('rally_leader_weight', leaderHeroNorm)
  const joiner = score('joiner_weight', joinerHeroNorm) * troopTypeMult
  const castle = score('castle_weight', leaderHeroNorm)
  const turretLeader = score('turret_leader_weight', leaderHeroNorm)
  const turretJoiner = score('turret_joiner_weight', joinerHeroNorm)
  const garrison = score('garrison_weight', leaderHeroNorm)
  const support = score('support_weight', joinerHeroNorm)

  return {
    rallyLeader,
    joiner,
    castle,
    turretLeader,
    turretJoiner,
    garrison,
    support,
    // Back-compat mappings for the fixed member_scores columns
    turret: turretLeader,
    defender: garrison,
    overall: Math.max(rallyLeader, joiner, castle, turretLeader, garrison, support),
  }
}
