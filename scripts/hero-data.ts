/**
 * Hero seed data with real game mechanics (PART 2).
 *
 * Sourced from verified community research (kingshothandbook.com,
 * kingshotmastery.com, kingshotguides.com).
 *
 * effect_op codes determine how skills stack in the damage formula:
 *   - SAME effect_op codes ADD together (additive)
 *   - DIFFERENT effect_op codes MULTIPLY together (much stronger)
 *
 * Skill slots:
 *   - slot 1            = joiner skill (only this one applies when joining a rally)
 *   - slots 2-3         = leader-only skills (apply when leading a rally)
 *   - slot 4            = bonus skill from widget (only when widget_unlocked = true)
 */

export interface ExpeditionSkill {
  slot: number
  name: string
  effect_op: number | string
  effect_type: string
  base_value: number
  is_joiner_skill: boolean
  chance?: number
  requires_widget?: boolean
  notes?: string
}

export interface WidgetEffect {
  type: 'offensive' | 'defensive' | 'mixed'
  stat?: string
  multiplier?: boolean
  notes?: string
}

export interface HeroSeed {
  name: string
  primary_role: 'rally_leader' | 'joiner' | 'garrison' | 'support'
  expedition_skills: ExpeditionSkill[]
  widget_effect?: WidgetEffect
}

export const HEROES: HeroSeed[] = [
  // ----- GEN 1 -----------------------------------------------------------
  {
    name: 'Amadeus', // Gen 1, Mythic, Infantry — only offensive infantry widget in the game
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Infantry Lethality Boost', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true, notes: 'Flat +25% Squad Lethality. Stacks additively with other 101 heroes.' },
      { slot: 2, name: 'Infantry Attack Aura', effect_op: 101, effect_type: 'DamageUp', base_value: 20, is_joiner_skill: false },
      { slot: 3, name: 'Aegis Amplifier', effect_op: 101, effect_type: 'DamageUp', base_value: 15, is_joiner_skill: false },
      { slot: 4, name: 'Widget: Aegis of Fate', effect_op: 101, effect_type: 'DamageUp', base_value: 30, is_joiner_skill: false, requires_widget: true },
    ],
    widget_effect: { type: 'offensive', stat: 'infantry_attack_lethality', multiplier: true, notes: 'UNIQUE - only offensive infantry widget in game. Multiplicative rally bonus amplifying entire squad output.' },
  },
  {
    name: 'Jabel', // Gen 1, Mythic, Cavalry — best F2P defensive hero early game
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Cavalry Defense Aura', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'Squad Damage Reduction', effect_op: 111, effect_type: 'DamageReduction', base_value: 15, is_joiner_skill: false },
      { slot: 3, name: 'Cavalry Health Boost', effect_op: 113, effect_type: 'HealthUp', base_value: 20, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', stat: 'cavalry_defense_health', multiplier: true, notes: 'Garrison/defense widget. Carries through Gen 1-2 before transitioning to Zoe.' },
  },
  {
    name: 'Saul', // Gen 1, Mythic, Archer
    primary_role: 'support',
    expedition_skills: [
      { slot: 1, name: 'Archer Defense Boost', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: true, notes: 'Defensive joiner. Pairs with Gordon (113) for 2.16x DefenseUp multiplier.' },
      { slot: 2, name: 'Squad Health Aura', effect_op: 113, effect_type: 'HealthUp', base_value: 15, is_joiner_skill: false },
      { slot: 3, name: 'Construction Speed', effect_op: 999, effect_type: 'BuildBonus', base_value: 0, is_joiner_skill: false, notes: 'Non-combat skill.' },
    ],
  },
  {
    name: 'Helga', // Gen 1, Mythic, Infantry
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Infantry Defense Aura', effect_op: 112, effect_type: 'DefenseUp', base_value: 20, is_joiner_skill: true },
      { slot: 2, name: 'Squad Health Boost', effect_op: 113, effect_type: 'HealthUp', base_value: 20, is_joiner_skill: false },
      { slot: 3, name: 'Damage Reduction', effect_op: 111, effect_type: 'DamageReduction', base_value: 15, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', stat: 'infantry_defense', multiplier: true },
  },
  {
    name: 'Chenko', // Gen 1, Epic, Cavalry — premier offensive joiner. NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Squad Lethality', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true, notes: 'CRITICAL: Flat +25% Squad Lethality. effect_op 101. Stacks additively with other 101 heroes. Multiplies with effect_op 102 (Amane). 2x Chenko + 2x Amane = 1.5x1.5=2.25x vs 4x Chenko = 2.0x.' },
      { slot: 2, name: 'Cavalry Attack Boost', effect_op: 101, effect_type: 'DamageUp', base_value: 15, is_joiner_skill: false },
    ],
  },
  {
    name: 'Howard', // Gen 1, Epic, Infantry — defensive joiner. NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Damage Reduction', effect_op: 111, effect_type: 'DamageReduction', base_value: 20, is_joiner_skill: true, notes: 'effect_op 111. Multiplies with Gordon (113) and Saul (112). Use Howard OR Quinn not both.' },
      { slot: 2, name: 'Infantry Health', effect_op: 113, effect_type: 'HealthUp', base_value: 15, is_joiner_skill: false },
    ],
  },
  {
    name: 'Gordon', // Gen 1, Epic, Archer — NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Squad Health Boost', effect_op: 113, effect_type: 'HealthUp', base_value: 25, is_joiner_skill: true, notes: 'effect_op 113. Pairs with Saul (112) for 2x Saul + 2x Gordon = 2.16x DefenseUp.' },
      { slot: 2, name: 'Archer Defense', effect_op: 112, effect_type: 'DefenseUp', base_value: 15, is_joiner_skill: false },
    ],
  },
  {
    name: 'Quinn', // Gen 1, Epic, Archer — identical to Howard. NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Damage Reduction', effect_op: 111, effect_type: 'DamageReduction', base_value: 20, is_joiner_skill: true, notes: 'effect_op 111. SAME as Howard. Use Howard OR Quinn as joiner, never both.' },
      { slot: 2, name: 'Archer Attack', effect_op: 101, effect_type: 'DamageUp', base_value: 10, is_joiner_skill: false },
    ],
  },
  {
    name: 'Diana', // Gen 1, Epic, Cavalry — NO WIDGET
    primary_role: 'support',
    expedition_skills: [
      { slot: 1, name: 'Cavalry Speed', effect_op: 999, effect_type: 'MarchSpeed', base_value: 15, is_joiner_skill: true, notes: 'Non-combat joiner skill. Limited rally value.' },
      { slot: 2, name: 'Defense Aura', effect_op: 112, effect_type: 'DefenseUp', base_value: 10, is_joiner_skill: false },
    ],
  },
  {
    name: 'Yeonwoo', // Gen 1, Epic, Archer — same effect_op as Chenko (101). NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Team Lethality', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true, notes: 'effect_op 101. Same code as Chenko - adds additively. Still valuable. Prioritize to 4 stars, pair with Chenko.' },
      { slot: 2, name: 'Research Speed', effect_op: 999, effect_type: 'ResearchBonus', base_value: 15, is_joiner_skill: false },
    ],
  },
  {
    name: 'Amane', // Gen 1, Epic, Archer — effect_op 102, multiplies with Chenko. NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Squad Attack Boost', effect_op: 102, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true, notes: 'CRITICAL: effect_op 102. Different from Chenko/Yeonwoo (101). Multiplies: 2x Chenko(101) + 2x Amane(102) = 1.5x1.5=2.25x vs 4x same = 2.0x. 12.5% more damage from hero diversity.' },
      { slot: 2, name: 'Attack Speed', effect_op: 102, effect_type: 'DamageUp', base_value: 10, is_joiner_skill: false },
    ],
  },
  {
    name: 'Fahd', // Gen 1, Epic, Infantry — unique OppDamageDown debuffer (201). NO WIDGET
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Enemy Damage Reduction', effect_op: 201, effect_type: 'OppDamageDown', base_value: 20, is_joiner_skill: true, notes: 'effect_op 201. Reduces ENEMY damage output. Pairs with Eric (202) for 1.44x OppDamageDown multiplier.' },
      { slot: 2, name: 'Infantry Defense', effect_op: 112, effect_type: 'DefenseUp', base_value: 15, is_joiner_skill: false },
    ],
  },

  // ----- GEN 2 -----------------------------------------------------------
  {
    name: 'Zoe', // Gen 2, Mythic, Infantry — best F2P garrison hero
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Infantry Defense Buff', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'Squad Damage Reduction', effect_op: 111, effect_type: 'DamageReduction', base_value: 20, is_joiner_skill: false },
      { slot: 3, name: 'Squad Health Aura', effect_op: 113, effect_type: 'HealthUp', base_value: 20, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', notes: 'Garrison cornerstone for 4+ generations. NEVER use as attack rally leader.' },
  },
  {
    name: 'Hilde', // Gen 2, Mythic, Cavalry — UNIQUE double effect_op (102+112) in slot 1
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Elixir of Strength', effect_op: '102+112', effect_type: 'DamageUp+DefenseUp', base_value: 15, is_joiner_skill: true, notes: 'UNIQUE: Contains BOTH effect_op 102 (DamageUp) AND 112 (DefenseUp) in ONE skill. Rare double-op. When stacking 4x Hilde, SkillMod produces larger multiplier than most heroes. Also provides healing sustain.' },
      { slot: 2, name: 'Cavalry Damage Boost', effect_op: 101, effect_type: 'DamageUp', base_value: 15, is_joiner_skill: false },
      { slot: 3, name: 'Squad Heal', effect_op: 999, effect_type: 'Healing', base_value: 20, is_joiner_skill: false, notes: 'Sustain that makes rallies survive longer.' },
    ],
    widget_effect: { type: 'mixed' },
  },
  {
    name: 'Marlin', // Gen 2, Mythic, Archer — S-tier rally attack from Gen 2
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Wild Card', effect_op: 103, effect_type: 'ChanceDamageUp', base_value: 40, chance: 40, is_joiner_skill: true, notes: '40% chance to increase squad damage by 40%. Chance-based - less reliable than flat bonuses.' },
      { slot: 2, name: 'Rumhead', effect_op: 201, effect_type: 'OppDamageDown', base_value: 50, chance: 20, is_joiner_skill: false },
      { slot: 3, name: 'Dynamo', effect_op: 103, effect_type: 'ChanceDamageUp', base_value: 50, chance: 50, is_joiner_skill: false },
    ],
  },

  // ----- GEN 3 -----------------------------------------------------------
  {
    name: 'Eric', // Gen 3, Mythic, Infantry — defender-debuffer hybrid (202)
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Enemy Weakness', effect_op: 202, effect_type: 'OppDamageDown', base_value: 25, is_joiner_skill: true, notes: 'effect_op 202. Multiplies with Fahd (201): Eric(202) + Fahd(201) = 1.44x OppDamageDown.' },
      { slot: 2, name: 'Infantry Defense', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'HP Fortify', effect_op: 113, effect_type: 'HealthUp', base_value: 20, is_joiner_skill: false, notes: '49,950 HP base — highest in Gen 3 class.' },
    ],
  },
  {
    name: 'Petra', // Gen 3, Mythic, Cavalry — NON-NEGOTIABLE rally attack (105 whole-rally ATK)
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Change of Fate', effect_op: 103, effect_type: 'ChanceDamageUp', base_value: 50, chance: 40, is_joiner_skill: true, notes: 'Chance-based as joiner. Use as rally leader for full value from skill 3.' },
      { slot: 2, name: 'Turn Card', effect_op: 999, effect_type: 'Healing', base_value: 0, is_joiner_skill: false },
      { slot: 3, name: 'Rally Troop ATK', effect_op: 105, effect_type: 'RallyMultiplier', base_value: 30, is_joiner_skill: false, notes: 'CRITICAL: Multiplicative bonus applying to ENTIRE alliance rally. Most valuable PvE rally skill in game.' },
    ],
    widget_effect: { type: 'offensive', notes: 'High investment priority through Gen 5.' },
  },
  {
    name: 'Jaeger', // Gen 3, Mythic, Archer
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'The Tempest', effect_op: 103, effect_type: 'ChanceDamageUp', base_value: 40, chance: 20, is_joiner_skill: true },
      { slot: 2, name: 'The Resistance', effect_op: 201, effect_type: 'OppDamageDown', base_value: 50, chance: 20, is_joiner_skill: false },
      { slot: 3, name: 'The Celebration', effect_op: 113, effect_type: 'HealthUp', base_value: 25, is_joiner_skill: false },
    ],
  },

  // ----- GEN 4 -----------------------------------------------------------
  {
    name: 'Rosa', // Gen 4, Mythic, Archer — primary archer rally leader
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Archer Lethality Aura', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'Squad Attack Amplify', effect_op: 102, effect_type: 'DamageUp', base_value: 20, is_joiner_skill: false },
      { slot: 3, name: 'Precision Strike', effect_op: 101, effect_type: 'DamageUp', base_value: 20, is_joiner_skill: false },
    ],
  },
  {
    name: 'Margot', // Gen 4, Mythic, Cavalry — best joiner pick at Gen 4
    primary_role: 'joiner',
    expedition_skills: [
      { slot: 1, name: 'Area Damage Boost', effect_op: 102, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true, notes: 'effect_op 102. Multiplicative with 101 heroes. Best choice for joiners at Gen 4.' },
      { slot: 2, name: 'Cavalry Amplify', effect_op: 101, effect_type: 'DamageUp', base_value: 20, is_joiner_skill: false },
      { slot: 3, name: 'Force Multiplier', effect_op: 102, effect_type: 'DamageUp', base_value: 20, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', notes: 'Defensive widget is slight mismatch for offensive kit but raw power compensates.' },
  },
  {
    name: 'Alcar', // Gen 4, Mythic, Infantry — garrison core (Zoe + Eric + Alcar)
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Infantry Lethality Down', effect_op: 202, effect_type: 'OppDamageDown', base_value: 20, is_joiner_skill: true },
      { slot: 2, name: 'Squad Defense', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Health Fortify', effect_op: 113, effect_type: 'HealthUp', base_value: 25, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', notes: 'Defender widget. Part of optimal garrison core: Zoe + Eric + Alcar.' },
  },

  // ----- GEN 5 -----------------------------------------------------------
  {
    name: 'Long Fei', // Gen 5, Mythic, Infantry
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Frontline Immortality', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'Infantry Lethality', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Squad Fortify', effect_op: 113, effect_type: 'HealthUp', base_value: 30, is_joiner_skill: false },
    ],
    widget_effect: { type: 'offensive', notes: 'Gen 5 infantry rally leader.' },
  },
  {
    name: 'Vivian', // Gen 5, Mythic, Archer — unique OppDamageUp (200) amplifies whole army
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Crouching Tiger', effect_op: 200, effect_type: 'OppDamageUp', base_value: 25, is_joiner_skill: true, notes: 'UNIQUE: Permanently increases ALL enemy damage taken by 25%. Unique effect_op 200. Amplifies your entire armies damage — not just squad. Revolutionary for alliance-wide damage.' },
      { slot: 2, name: 'Focus Fire', effect_op: 102, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Archer Supremacy', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
    ],
    widget_effect: { type: 'offensive', notes: 'Ultimate offensive support. Fragile - protect with infantry.' },
  },
  {
    name: 'Thrud', // Gen 5, Mythic, Cavalry
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Cavalry Lethality Boost', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'AoE Cavalry Strike', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Cavalry Health', effect_op: 113, effect_type: 'HealthUp', base_value: 30, is_joiner_skill: false },
    ],
  },

  // ----- GEN 6 -----------------------------------------------------------
  {
    name: 'Triton', // Gen 6, Mythic, Infantry — strongest frontline, cross-troop buffs
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Command of Power', effect_op: 112, effect_type: 'DefenseUp', base_value: 25, is_joiner_skill: true },
      { slot: 2, name: 'Warfare of Power', effect_op: 105, effect_type: 'SkillDamageUp', base_value: 30, is_joiner_skill: false },
      { slot: 3, name: 'Oath of Power', effect_op: 113, effect_type: 'HealthUp', base_value: 25, is_joiner_skill: false, notes: 'Infantry +20% HP, Cavalry/Archer +30% HP' },
    ],
    widget_effect: { type: 'defensive', stat: 'infantry_lethality_health', notes: 'Tidal Scepter. Maxes Infantry Lethality and Health. +30% flat damage boost. Gen 6 max: 600,750 power, 133.5% passives.' },
  },
  {
    name: 'Sophia', // Gen 6, Mythic, Cavalry
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Cavalry Attack Supremacy', effect_op: 101, effect_type: 'DamageUp', base_value: 30, is_joiner_skill: true },
      { slot: 2, name: 'Squad Lethality Aura', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Elite Cavalry Boost', effect_op: 102, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
    ],
    widget_effect: { type: 'offensive', stat: 'cavalry_lethality_health', notes: 'Scarlet Rose widget. Gen 6 max: 600,750 power, 133.5% passives.' },
  },
  {
    name: 'Yang', // Gen 6, Mythic, Archer — highest Hero Attack stat in game
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Avalanche', effect_op: 101, effect_type: 'DamageUp', base_value: 30, is_joiner_skill: true, notes: 'Yang has highest Hero Attack stat in game. Causes all squads to land additional strikes.' },
      { slot: 2, name: 'Deadshot', effect_op: 104, effect_type: 'CritRate', base_value: 15, is_joiner_skill: false },
      { slot: 3, name: 'Combo', effect_op: 103, effect_type: 'ChanceDamageUp', base_value: 50, chance: 35, is_joiner_skill: false },
    ],
    widget_effect: { type: 'offensive', notes: 'Gen 6 max: 600,750 power, 133.5% passives.' },
  },

  // ----- GEN 7 -----------------------------------------------------------
  {
    name: 'Ava', // Gen 7, Mythic, Cavalry — cavalry rally leader upgrade
    primary_role: 'rally_leader',
    expedition_skills: [
      { slot: 1, name: 'Cavalry Supremacy', effect_op: 101, effect_type: 'DamageUp', base_value: 35, is_joiner_skill: true },
      { slot: 2, name: 'Elite Strike', effect_op: 102, effect_type: 'DamageUp', base_value: 30, is_joiner_skill: false },
      { slot: 3, name: 'Battle Aura', effect_op: 101, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
    ],
    widget_effect: { type: 'offensive', notes: 'Gen 7 cavalry rally-widget upgrade over Sophia. Max: 722,250 power, 160.5% lethality/health passives at level 10.' },
  },
  {
    name: 'Charles', // Gen 7, Mythic, Infantry — garrison/defense anchor
    primary_role: 'garrison',
    expedition_skills: [
      { slot: 1, name: 'Infantry Command', effect_op: 112, effect_type: 'DefenseUp', base_value: 35, is_joiner_skill: true },
      { slot: 2, name: 'Fortress Wall', effect_op: 113, effect_type: 'HealthUp', base_value: 30, is_joiner_skill: false },
      { slot: 3, name: 'Iron Bastion', effect_op: 111, effect_type: 'DamageReduction', base_value: 25, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', notes: 'Gen 7 garrison-widget upgrade. Best for city defense, Castle Battle, structure holds. Max: 722,250 power, 160.5% passives.' },
  },
  {
    name: 'Wee & Woo', // Gen 7, Mythic, Archer — F2P realistic Gen 7 widget target
    primary_role: 'support',
    expedition_skills: [
      { slot: 1, name: 'Mortar Strike', effect_op: 101, effect_type: 'DamageUp', base_value: 30, is_joiner_skill: true, notes: 'Bear Hunt / rally join value is here. Widget (Mortar) is defensive-type so does NOT activate for attack rallies.' },
      { slot: 2, name: 'Archer Support', effect_op: 102, effect_type: 'DamageUp', base_value: 25, is_joiner_skill: false },
      { slot: 3, name: 'Team Shield', effect_op: 111, effect_type: 'DamageReduction', base_value: 20, is_joiner_skill: false },
    ],
    widget_effect: { type: 'defensive', notes: 'F2P Gen 7 widget via Roulette. Slots in as Gen 7 alternative to Chenko/Amane joiner stack. Max: 722,250 power, 160.5% passives.' },
  },
]
