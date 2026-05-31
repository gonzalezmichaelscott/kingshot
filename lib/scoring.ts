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

export interface MemberHeroData {
  hero: {
    generation: number
    troop_type: string | null
    role: string | null
  }
  starLevel: number
  widgetLevel: number
  expeditionSkillLevels: Record<string, number>
}

export interface MemberProfile {
  id: string
  power: number
  troopCount: number
  marchSize: number
  rallyCapacity: number
  combatStats: CombatStats
  heroes: MemberHeroData[]
  primaryTroopType: 'infantry' | 'cavalry' | 'archer' | 'mixed'
}

export interface RoleScores {
  rallyLeader: number
  joiner: number
  castle: number
  turret: number
  support: number
  defender: number
  overall: number
}

// Hero score: generation + star + widget + expedition skills only
export function calculateHeroScore(heroes: MemberHeroData[]): number {
  return heroes.reduce((total, mh) => {
    const genBonus = mh.hero.generation * 10
    const starBonus = mh.starLevel * 15
    const widgetBonus = mh.widgetLevel * 8
    const skillBonus = Object.values(mh.expeditionSkillLevels)
      .reduce((s, v) => s + v, 0) * 3
    return total + genBonus + starBonus + widgetBonus + skillBonus
  }, 0)
}

// Lethality is weighted 1.5x because it bypasses defense — key differentiator at high levels
export function calculateCombatScore(stats: CombatStats, troopType: string): number {
  const w = { attack: 1.0, defense: 0.7, health: 0.6, lethality: 1.5 }

  if (troopType === 'infantry') {
    return (stats.infantryAttack * w.attack) +
           (stats.infantryDefense * w.defense) +
           (stats.infantryHealth * w.health) +
           (stats.infantryLethality * w.lethality)
  }
  if (troopType === 'cavalry') {
    return (stats.cavalryAttack * w.attack) +
           (stats.cavalryDefense * w.defense) +
           (stats.cavalryHealth * w.health) +
           (stats.cavalryLethality * w.lethality)
  }
  if (troopType === 'archer') {
    return (stats.archerAttack * w.attack) +
           (stats.archerDefense * w.defense) +
           (stats.archerHealth * w.health) +
           (stats.archerLethality * w.lethality)
  }
  // mixed: average of all three
  const inf = (stats.infantryAttack * w.attack) + (stats.infantryDefense * w.defense) +
              (stats.infantryHealth * w.health) + (stats.infantryLethality * w.lethality)
  const cav = (stats.cavalryAttack * w.attack) + (stats.cavalryDefense * w.defense) +
              (stats.cavalryHealth * w.health) + (stats.cavalryLethality * w.lethality)
  const arc = (stats.archerAttack * w.attack) + (stats.archerDefense * w.defense) +
              (stats.archerHealth * w.health) + (stats.archerLethality * w.lethality)
  return (inf + cav + arc) / 3
}

// All weights come from the DB — no hardcoded formulas
export function calculateRoleScores(
  member: MemberProfile,
  weights: Record<string, Record<string, number>>
): RoleScores {
  const heroScore = calculateHeroScore(member.heroes)

  const score = (role: string) => {
    const w = weights[role] || {}
    return (
      (member.power / 1_000_000) * (w.power || 0) +
      (member.marchSize / 100_000) * (w.march_size || 0) +
      (member.rallyCapacity / 1_000_000) * (w.rally_capacity || 0) +
      (member.troopCount / 100_000) * (w.troop_count || 0) +
      (heroScore / 100) * (w.hero_score || 0)
    )
  }

  const rallyLeader = score('rally_leader_weight')
  const joiner = score('joiner_weight')
  const castle = score('castle_team_weight')
  const turret = score('turret_leader_weight')
  const support = score('support_weight')
  const defender = score('defender_weight')
  const overall = Math.max(rallyLeader, joiner, castle, turret)

  return { rallyLeader, joiner, castle, turret, support, defender, overall }
}
