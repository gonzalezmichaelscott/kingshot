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
    generation?: number
    troop_type?: string | null
    role?: string | null
    primary_role?: string | null
    has_widget?: boolean
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

export interface MemberProfile {
  id: string
  power: number
  troopCount: number
  marchSize: number
  rallyCapacity: number
  combatStats: CombatStats
  heroes: MemberHero[]
  primaryTroopType: 'infantry' | 'cavalry' | 'archer' | 'mixed'
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
 * RALLY LEADER hero score — leaders use ALL expedition skills from ALL 3 heroes.
 * Widget is highly multiplicative for leaders.
 */
export function calculateLeaderHeroScore(heroes: MemberHero[]): number {
  if (!heroes || heroes.length === 0) return 0
  return heroes.reduce((total, mh) => {
    const gen = mh.hero?.generation || 1
    const genBonus = gen * 18
    const totalShards = (mh.star_level || 0) * 6 + (mh.star_shards || 0)
    const starBonus = totalShards * 4
    const widgetBonus = mh.widget_unlocked
      ? (mh.widget_level || 0) * 25 * (gen >= 7 ? 1.5 : gen >= 6 ? 1.3 : gen >= 4 ? 1.1 : 1.0)
      : 0
    const skillLevels = (mh.expedition_skill_levels as Record<string, number>) || {}
    const skillBonus = Object.values(skillLevels).reduce((s, v) => s + (v as number) * 8, 0)
    const reliabilityBonus = calculateReliabilityBonus(mh.hero?.expedition_skills)
    return total + genBonus + starBonus + widgetBonus + skillBonus + reliabilityBonus
  }, 0)
}

/**
 * RALLY JOINER hero score — only the FIRST expedition skill of the lead hero applies.
 */
export function calculateJoinerHeroScore(leadHero: MemberHero | null): number {
  if (!leadHero) return 0
  const gen = leadHero.hero?.generation || 1
  const genBonus = gen * 10
  const totalShards = (leadHero.star_level || 0) * 6 + (leadHero.star_shards || 0)
  const starBonus = totalShards * 2
  const widgetBonus = leadHero.widget_unlocked ? (leadHero.widget_level || 0) * 8 : 0
  const skillLevels = (leadHero.expedition_skill_levels as Record<string, number>) || {}
  const skillKeys = Object.keys(skillLevels)
  const firstSkillLevel = skillKeys.length > 0 ? (skillLevels[skillKeys[0]] || 0) : 0
  const firstSkillBonus = firstSkillLevel * 20
  const firstOp = getFirstSkillEffectOp(leadHero.hero?.expedition_skills)
  const isReliable = firstOp !== null && firstOp !== 103 && firstOp !== 999
  const reliabilityBonus = isReliable ? 15 : 0
  return genBonus + starBonus + widgetBonus + firstSkillBonus + reliabilityBonus
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

/** Troop counter: Infantry > Archer > Cavalry > Infantry. */
export function getTroopCounterBonus(attackerType: string, defenderType: string): number {
  const counters: Record<string, string> = {
    infantry: 'archer',
    archer: 'cavalry',
    cavalry: 'infantry',
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
 */
export function calculateRoleScores(
  member: MemberProfile,
  scoringWeights: Record<string, Record<string, number>>,
  enemyTroopType?: string
): RoleScores {
  const leaderHeroScore = calculateLeaderHeroScore(member.heroes)
  const joinerHeroScore = calculateJoinerHeroScore(member.heroes?.[0] || null)

  const powerNorm = (member.power || 0) / 1_000_000
  const marchNorm = (member.marchSize || 0) / 100_000
  const rallyNorm = (member.rallyCapacity || 0) / 1_000_000
  const troopNorm = Math.sqrt(member.troopCount || 0) / 100 // sqrt scaling per formula
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

  const rallyLeader = score('rally_leader_weight', leaderHeroNorm)
  const joiner = score('joiner_weight', joinerHeroNorm)
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
