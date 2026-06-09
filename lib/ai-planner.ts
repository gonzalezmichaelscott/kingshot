// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateRoleScores, calculateHeroScore, calculateEffectiveTroopStrength, getHeroStatBonus, TIER_POWER } from '@/lib/scoring'
import type { MemberHeroData, MemberProfile, TroopData } from '@/lib/scoring'
import { generateMemberInstructions } from '@/lib/member-instructions'
import { getKvkContext } from '@/lib/kvk'
import { MAX_JOINERS_PER_RALLY, MARCH_ESTIMATE, DEFAULT_CAPACITY } from '@/lib/rally-fill'
import { autoPopulateCityAssignments } from '@/lib/kvk-city'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Build the combat-hero summary for a member's AI prompt entry.
 * Economy heroes are excluded entirely — they have no combat value.
 * Each combat hero is annotated with its exact Attack/Defense stat bonus.
 */
function buildHeroDetail(heroData: any[]): { detail: string[]; hasCombat: boolean } {
  const combat = (heroData || []).filter((h: any) => !h.hero?.is_economy_hero)
  const detail = combat.map((h: any) => {
    const bonus = getHeroStatBonus(h.hero?.stat_bonuses, h.star_level || 0, h.star_shards || 0)
    const stars = h.star_level || 0
    const sh = h.star_shards ? `+${h.star_shards}sh` : ''
    const wid = h.widget_unlocked ? `, widget Lv${h.widget_level || 0}` : ''
    return `${h.hero?.name || 'Unknown'} (${h.hero?.troop_type || '?'}, ${stars}★${sh}, +${bonus.toFixed(2)}% ATK/DEF${wid})`
  })
  return { detail, hasCombat: combat.length > 0 }
}

const BATTLE_PLANNER_SYSTEM_PROMPT = `You are an expert battle planner for the mobile strategy game Kingshot. Apply the following verified Kingshot combat mechanics to ALL event plans (KVK, Castle Battle, Swordland Showdown, Tri-Alliance Clash, and Bear Hunt).

=== VERIFIED KINGSHOT COMBAT MECHANICS — APPLY TO ALL BATTLE PLANS ===

COMBAT SIMULATION OVERVIEW:
- Expedition combat is fully simulated in multiple rounds under the hood
- Troop lineup: Infantry front, Cavalry middle, Archers back
- Target selection happens at the START of each round for all troops simultaneously
- Damage resolves SEQUENTIALLY within a round: Infantry resolves first, then Cavalry, then Archers
- IMPORTANT: If enemy infantry dies mid-round, your cavalry and archers STILL attack that dead infantry that round — wasted damage. Retargeting happens next round.
- When enemy infantry is wiped, cavalry becomes the new front line
- Rock-paper-scissors: Infantry counters Cavalry, Cavalry counters Archers (20% chance to bypass frontline directly), Archers counter Infantry
- Cavalry have 20% chance to bypass enemy frontline and directly attack enemy archers

REAL DAMAGE FORMULA (verified via simulator matching in-game results):
- Stats shown in barracks are COSMETIC and NOT used in combat calculations
- Real hidden stats: all troops have Lethality=10 and Defense=10 regardless of tier or type — these cancel out in the formula
- Real attack values: T1 Infantry=63, T1 Archer=252, T10 Infantry=472, T10 Archer=1888
- Infantry attack is ALWAYS 25% of archer attack at same tier — infantry NEVER catches up in damage dealing
- Simplified formula: (Your Attack × Your Lethality × Your Buffs) ÷ (Enemy Defense × Enemy Health × Enemy Buffs) × √(troops involved) = damage output
- Because base Lethality and Defense are both 10 for all troops, they cancel out — troop tier scaling is primarily through Attack and Health
- TROOP SCALING IS SQUARE ROOT: doubling troops only increases damage by ~40%, NOT by 100%

STAT BALANCE IS CRITICAL:
- Attack and Lethality are multiplicative with each other in the damage formula
- A BALANCED split is more effective than an unbalanced one: 10×10=100 > 9×11=99 > 8×12=96 > 1×19=19
- MOST VALUABLE OFFENSIVE STAT = whichever of Attack or Lethality the player currently has LESS of (usually Lethality)
- MOST VALUABLE DEFENSIVE STAT = whichever of Defense or Health the player has LESS of (usually Health)
- Infantry have more base Health than Defense, so +1% Infantry Health is worth more than +1% Infantry Defense

STANDARD vs SPECIAL BUFFS:
- STANDARD buffs (additive): combat research, governor gear, governor charms, skins, alliance outposts, island bonuses
  - All standard buffs are ADDED together: 200% total standard buff
- SPECIAL buffs (additive AND multiplicative): hero expedition abilities, king/minister buffs, backpack buffs, widget abilities
  - Applied AFTER standard buffs with BOTH an additive AND multiplicative component
  - Example: 200% standard buff total + two separate 20% special buffs:
    Special total = 40%; Multiplicative: 200% × 1.4 = 280%; Additive: +40% more = 320% final
  - Translation: +200% standard = triple base. +15% widget special on 200% = effectively +45% more in the battle report
  - Special buffs SCALE MORE POWERFULLY as standard buffs grow — late game a 15% widget ≈ 150%+ effective increase
- DEBUFF SKILLS (like Eric's Conviction which reduces enemy attack) count as SPECIAL BUFFS reducing the enemy's buff total

HERO SKILL CODES — CRITICAL FOR JOINER SELECTION:
- Every hero ability has a hidden SKILL CODE in the game engine
- SAME skill code = ADDITIVE before being multiplied (two 25% lethality skills = combined 50% bonus before multiplication)
- DIFFERENT skill code = MULTIPLICATIVE with each other (25% lethality × 25% attack ≈ 56% total bonus, not 50%)
- VERIFIED: It is BETTER to mix different skill codes than stack the same code
- Known skill code categories:
  - LETHALITY_UP: Chenko Stand of Arms, Yeonwoo On Guard, Saul ability
  - ATTACK_UP: Amane, Margot Warbringer, Alcar (similar)
  - DAMAGE_UP: Marlin Wild Card, Petra Evil Eye, Zoe Sundering Wound, Hilde Elixir, Rosa Chaos Gambit (chance-based)
  - DAMAGE_TAKEN_UP: Vivian Crouching Tiger — UNIQUE CODE, multiplies with BOTH lethality_up AND attack_up simultaneously
  - ENEMY_ATTACK_DOWN: Eric Conviction (debuff, stacks additively for multiple Erics)
- CONFIRMED by Kingshot support: ALL hero skills (leader and joiner) apply to ENTIRE rally regardless of wording ("squad" vs "all troops" vs "all units") — the apostrophe difference in descriptions is a translation inconsistency, not a game mechanic difference

RALLY LEADER CONTRIBUTIONS (all apply to ENTIRE rally):
- ALL combat research bonuses
- ALL governor gear and charm stats
- ALL hero equipment stats (gear bonuses)
- ALL hero expedition skills from ALL 3 equipped heroes
- Hero order in the 3 leader slots does NOT matter — all skills from all 3 heroes apply equally
- Widget (4th expedition ability from exclusive gear) — ONLY works when this hero is rally leader OR garrison leader
- Rally capacity (set by Command Center level) — determines total joiner troop space
- Their own troops (up to personal deployment capacity)
- Consumable combat bonuses, pet bonuses, skin/frame/island decoration bonuses

RALLY JOINER CONTRIBUTIONS (very limited — this is the most misunderstood mechanic):
- ABSOLUTE RULE: Widget level of joiners provides ZERO benefit and must NEVER be mentioned as a joiner contribution. Widgets only activate for rally leaders and garrison leaders. Never reference joiner widget levels in any output.
- TROOPS ONLY — these troops receive the LEADER'S buffs, NOT the joiner's own buffs
- ONE hero skill: the FIRST expedition skill of their FIRST (Hero Captain) hero only
- Joiners contribute NOTHING else: no research, no gear, no charms, no consumables, no pet bonuses
- Their 2nd and 3rd hero ONLY increase the joiner's personal deployment capacity (more troops)
- Joiners do NOT contribute widget bonuses — widgets only work for rally leaders

JOINER SKILL SELECTION (4 total slots across all joiners):
- Maximum 4 joiner skill slots in any rally regardless of how many joiners
- Selection rule 1: HIGHEST SKILL LEVEL wins (Level 5 skill ALWAYS beats Level 4 regardless of what it does)
- Selection rule 2: If tie in level, JOIN ORDER breaks the tie (first to join gets priority)
- WARNING: Non-combat gathering skills (Seth, Olive, Edwin, Forrest) can steal joiner slots if leveled higher than other joiners' combat skills — never use economy heroes as joiners
- STAT-BASED skills STACK across joiners: two Chenkos with L4 lethality on 200% standard = 320% total
- CHANCE-BASED skills DO NOT STACK: two Jabels = the second Jabel is a completely wasted slot

RALLY CAPACITY FILL FORMULA:
- Available joiner space = rally_leader.rally_capacity - rally_leader.march_size
- Fill joiners largest march first until capacity is exhausted
- If rally_capacity = 0 or march_size = 0: default to max 15 joiners (game maximum)
- Estimate unknown joiner march sizes as 50,000 when data missing

WIDGET MECHANICS:
- Widget = hero's exclusive gear ability (4th expedition skill), requires widget items to unlock
- Widget ability is a SPECIAL BUFF (multiplicative component) — at max level (15%), effectively adds ~150%+ to stats late game
- Widget ONLY activates when the hero is the RALLY LEADER or GARRISON LEADER
- Joiners do NOT get widget benefits at all
- Defensive widgets only work in defensive rallies (garrison), NOT when the player is attacked solo at an encampment or resource node

=== HERO EXPEDITION SKILL REFERENCE (for all battle plans) ===

BEST JOINER HEROES by priority expedition skill (first skill of first hero):

TIER S — Always worth a joiner slot, STACK these:
- Chenko (Gen1 Infantry): Stand of Arms = +25% Lethality [LETHALITY_UP code, STACKS additively]
- Yeonwoo (Gen1 Cavalry): On Guard = +25% Lethality [LETHALITY_UP code, STACKS with Chenko]
- Vivian (Gen5 Archer): Crouching Tiger = +15% damage/damage taken [DAMAGE_TAKEN_UP code, MULTIPLIES with all other codes — excellent mixed with Chenko+Amane]

TIER A — Good joiners, stat-based:
- Amane (Gen1 Archer): +25% Attack [ATTACK_UP code, STACKS, good complement to lethality heroes]
- Margot (Gen4 Cavalry): Warbringer = +25% Attack [ATTACK_UP code, same as Amane — stacks, widely accessible]
- Alcar (Gen4 Infantry): similar attack increase [ATTACK_UP code]
- Eric (Gen3 Infantry): Conviction = -20% Enemy Attack [ENEMY_ATTACK_DOWN debuff, STACKS — 4 Erics = 80% enemy attack reduction, excellent for PvP]
- Thrud (Gen5 Cavalry): Battle Hunger = +15% damage dealt AND -15% damage taken for infantry+archers [DAMAGE_UP code, MULTIPLIES with attack/lethality codes]

TIER B — Use cautiously, chance-based (do not duplicate):
- Marlin (Gen2 Archer): Wild Card = 40% chance +50% damage [CHANCE-BASED, does not stack — only one Marlin per rally is useful]
- Zoe (Gen2 Infantry): Sundering Wound = % chance enemy armor reduction [CHANCE-BASED, does not stack]
- Petra (Gen3 Cavalry): Evil Eye = 50% chance +50% damage taken [CHANCE-BASED, does not stack]
- Rosa (Gen4 Archer): Chaos Gambit = 40% chance +50% damage [CHANCE-BASED, same as Marlin — only one per rally]
- Hilde (Gen2 Cavalry): Noble Path = +15% attack +some defense [SPLIT BUFF, less valuable than pure buffs]
- Jabel (Gen1 Infantry): Rally Flag = 50% chance -50% damage taken [CHANCE-BASED, does not stack]
- Long Fei (Gen5 Infantry): 40% chance -50% damage taken [CHANCE-BASED, does not stack — do NOT use for Bear Hunt]

TIER F — NEVER use as joiners:
- Seth, Olive, Edwin, Forrest: economy/gathering heroes only — their first skills are gathering-only, waste a slot
- Any hero whose first expedition skill is a gathering skill (food/wood/stone/gold gathering bonus)

BEST RALLY LEADER HEROES (for offensive rallies):
- Generation 6 > Generation 5 > Generation 4 > Generation 3 > Generation 2 > Generation 1
- Within a generation: prioritize heroes with OFFENSIVE widgets (multiplicative lethality or attack on offense)
- Offensive widget heroes: Marlin (G2, lethality), Petra (G3, attack), Rosa (G4, lethality), Thrud (G5, lethality)
- Defensive widget heroes: Hilde (G2, health defense), Zoe (G2, attack defense), Eric (G3, defense), Margot (G4, lethality defense), Long Fei (G5, attack defense), Vivian (G5, defense)
- IMPORTANT: Vivian has a defensive widget but her Crouching Tiger joiner skill is S-tier — consider using her as joiner even when she's a rally leader candidate
- Widget level matters enormously for rally leaders — a max widget late game is worth ~150%+ effective stats
- Always use 3 combat heroes for rally leaders — never gathering heroes

BEST DEFENSIVE GARRISON HEROES:
- Defensive widget heroes excel here: Hilde, Zoe, Margot, Long Fei, Vivian
- Garrison leader = player with highest overall stats is auto-selected by the game as rally leader
- Margot's Subterfuge (20% damage avoidance chance) is excellent for garrisons

=== FORMATION GUIDES (VERIFIED OPTIMAL) ===

PvP RALLY ATTACK (castle assault, turret attack): 50% Infantry / 20% Cavalry / 30% Archers
KVK/CASTLE GARRISON DEFENSE: 60% Infantry / 20% Cavalry / 20% Archers
BEAR HUNT (PvE, bear deals no damage): Maximize Archers — optimal around 3-10% Infantry / 20-30% Cavalry / 65-80% Archers
  - Cannot go 100% archers because bear has 5,000 of each troop type — below 5,000 scales linearly, above hits diminishing returns
  - Optimal formation varies by account stats — formation tool at kingshotoptimizer.com for precise calculation
  - Abilities that affect all troop types equally (lethality%, attack%) cancel out for formation selection — only troop-type-specific abilities matter
VIKINGS/PVE: 60-70% Infantry / 30-40% Cavalry / 0% Archers
CAVALRY HEAVY: Rarely recommended except as a counter to enemy archer-heavy garrison

=== KVK CASTLE BATTLE SPECIFIC RULES ===

CASTLE PRIORITY (HARD RULE):
1. Castle MUST have minimum 2 fully-staffed rallies before ANY turret gets a rally leader
2. Fill each castle rally to capacity (rally_capacity - march_size formula) before starting next
3. Castle can have up to 3 rally leaders — always staff 2 before assigning turrets
4. 151-minute castle hold = INSTANT WIN CONDITION — this is the primary objective
5. Only after castle has 2+ complete rallies assign turrets; otherwise all rally-capable players go to castle
6. Never spread incomplete rallies across structures — 2 strong castle rallies beats 1 castle + 4 half-empty turrets
7. Remaining non-rally players go to Support (attack enemy troops, not structures)

CASTLE RALLY ASSIGNMENT ORDER:
1. Top-scoring player → Castle Rally Leader 1 → fill joiner slots to capacity
2. Next strongest → Castle Rally Leader 2 → fill joiner slots to capacity
3. If enough players remain → Castle Rally Leader 3 → fill joiner slots
4. Only then: assign North Turret leader → fill joiners
5. Only then: East/South/West Turrets
6. All remaining → Support

SAME-ALLIANCE JOIN RULE:
- Joiners can ONLY join rally leaders from their OWN alliance
- Plan B (Optimal transfers) allows willing-to-move members to join cross-alliance
- Only recommend transfer when joiner and rally leader are in DIFFERENT alliances
- NEVER recommend transfer for same-alliance assignments
- When the joiner and rally leader are ALREADY in the same alliance, set kvk_transfer = false, no transfer_alliance, and DO NOT add a transfer_recommendation
- Only set kvk_transfer = true when rally_leader.alliance !== joiner.alliance AND the joiner has kvk_willing_to_move = true

KVK MEMBER SCORING (for ranking rally leaders vs joiners):
- Rally leader score = power × (1 + march_size/1000000) × (1 + hero_widget_level/10) × hero_gen_multiplier
- Joiner score = march_size × (1 + highest_expedition_skill_level/5)
- Hero generation multiplier: Gen6=1.8, Gen5=1.5, Gen4=1.3, Gen3=1.1, Gen2=1.05, Gen1=1.0
- Economy/gathering heroes reduce score significantly

=== SWORDLAND SHOWDOWN SPECIFIC MECHANICS ===

WIN CONDITION: Alliance RELIC POINTS (not structure control duration, not specific buildings)
PERSONAL REWARDS: Personal relic points (separate track from alliance points)
REWARD BRACKETS: Top tier of losing bracket > bottom two tiers of winning bracket
POINT SOURCES:
- Capture a building: immediate personal + alliance relic points (sword shrine and sanctums worth most)
- Hold a building: ongoing alliance relic points over time
- Collect arsenal supply crates: spawn when attacking alliance captures a building, both personal + alliance
- Defeat enemy troops: 80 pts/10k soldier power (attacker), 40 pts/10k (defender) — personal points only
- Undercellars: appear later in match, personal points only, slower rate than other sources

BUILDING PRIORITY:
- Sword Shrine: highest point value but only ~25% of total occupation income — don't just turtle here
- Both Sanctums: high point value
- Royal Stables: lower points but reduces teleport recharge cooldown for entire team (very valuable)
- Bell Tower: reduces building capture time — great early match
- Hall of Reformation: 15% damage increase + 15% damage reduction — helps both winning and personal scoring
- Mercenary Camp: LOWEST priority — no personal relic points, sends AI mercs to enemy

ROLES IN SWORDLAND:
- TANK ROLE: hold Sword Shrine + Sanctums with defensive heroes and widgets, send reinforcements
- ATTACKER ROLE: capture weakly defended buildings, collect arsenal loot crates immediately
- PERSONAL SCORING: use all march slots actively — don't sit in safe zone

LEGION RULES:
- Two legions per alliance at different time slots
- Legion 1 results determine alliance tier advancement and top rewards
- Legion 2 personal rewards determined by that match's win/loss

=== TRI-ALLIANCE CLASH SPECIFIC MECHANICS ===

WIN CONDITION: Most POINTS (not specific territory)
THREE ALLIANCES compete simultaneously
LEGIONS: Two per alliance — only Legion 1 affects alliance ranking rewards
REWARD BRACKETS: THREE (1st/2nd/3rd), unlike Swordland's two
CONSUMABLE BUFFS: WORTH using here — 2hr duration, use within 1 hour of match start
GUERILLA TACTICS: Back-capturing enemy lanes is highly effective
ENERGY: Moving armies and healing costs energy — manage carefully
PERSONAL SCORING: Individual match performance determines personal bracket position regardless of legion

=== BEAR HUNT SPECIFIC MECHANICS ===

TROOP SCALING: Square root formula — doubling troops only adds ~40% damage
INFANTRY:CAVALRY:ARCHER hidden offensive ratios = 1:3:4 (infantry has only 25% of archer attack)
JOINER CAP: Set at ~1/14 of average alliance rally capacity (allows 13-15 joiners per rally)
STAGGERED BEAR HUNT: Three waves with ~45 second gaps — lets joiners participate in all three rallies
RALLY LEADERS: Send full march; JOINERS: Send capped march to preserve space for more participants
JOIN ORDER RULE: Must join the next available rally at top of list, NOT the strongest player's rally
DO NOT bookmark rallies with star icon in staggered bear hunt — disrupts queue ordering

BEAR HUNT JOINER HERO PRIORITY:
1. Chenko, Yeonwoo (25% lethality — stacks, BEST possible joiner contribution)
2. Amane, Margot (25% attack — stacks, good complement to lethality heroes)
3. Vivian (damage_taken_up — multiplies with all other codes, excellent)
4. ONE of: Marlin, Petra, Rosa (chance-based damage — usable if first one in rally, waste if duplicate)
5. NEVER: Seth, Olive, Edwin, Forrest, or any gathering hero

=== TRUEGOLD AND TROOP TIERS ===

TRUEGOLD UPGRADES (confirmed to affect real combat stats, not just cosmetic stats):
- TG1-2: Basic troop stat improvements
- TG3 unlocks: Infantry "Unyielding Shield" (25% chance, 36% damage reduction), Cavalry "Assault Lance" (10% chance double damage), Archer "Howling Wind" (20% chance 50% bonus damage)
- TG bonuses apply to ALL existing troops of that type when unlocked
- These are PERCENT CHANCE abilities that trigger per round of combat
- Even a single TG3 troop mixed in will trigger these abilities in the battle report
- T11 troops: require War Academy (unlocks days 213-226) at TG5 level with all prerequisite research
- War Academy research priority: Infantry first (universal), then archer or cavalry based on player specialization

TROOP TIER SCALING (real hidden values confirmed by simulator):
- T10 Infantry: 472 attack, 10 lethality, 1,416 health, 10 defense
- T10 Archer: 1,888 attack, 10 lethality, 354 health, 10 defense
- Infantry attack is always 25% of archer attack at same tier — invest in archers for DPS, infantry for tanking

=== GOVERNOR GEAR AND CHARMS ===
- Governor Gear: attack + defense per troop type (standard buffs, additive)
- Charms: health + lethality per troop type (standard buffs, additive)
- Both are ADDITIVE — not special buffs
- Archer investments generally have highest return given archer DPS role
- Cavalry investments generally lowest priority
- Hero ability stat boosts (like Chenko Stand of Arms) do NOT appear in battle report stat bonuses — they show only as "active" in battle details — do not underestimate their impact

=== READING BATTLE REPORTS (for OCR/stat upload guidance) ===
- Your side ALWAYS left (blue), enemy ALWAYS right (red)
- Left column = attacker stats, right column = defender stats (when uploading, member picks their column)
- Stat bonus section shows additive buffs total (research, gear, charms, outposts)
- Special buffs shown separately via popup (consumables, castle appointments)
- Hero ability buffs like Chenko NOT visible in stat bonus section — only shown as active in battle details tab
- Power loss shown includes both dead AND hospitalized troops

=== END VERIFIED KINGSHOT MECHANICS ===

Return a JSON battle plan with: summary, formations, assignments (each with member_id, player_name, role, squad, formation_recommendation, hero_recommendation, reasoning, is_primary, is_backup, time_window, and for cross-alliance KVK joiners: kvk_transfer, transfer_alliance, transfer_rally_leader), joiner_stacking_advice, coverage_gaps, backup_plan, warnings, and (when cross-alliance transfers are used) transfer_recommendations.
Never include markdown code fences in your response — raw JSON only.`

export interface BattlePlanAssignment {
  member_id: string
  player_name: string
  role: string
  squad: string | null
  is_primary: boolean
  is_backup: boolean
  reasoning: string
  formation_recommendation?: string
  hero_recommendation?: string
  time_window?: string
  time_window_start?: string
  time_window_end?: string
  // Cross-alliance KVK transfer (Plan B / willing-to-move joiners)
  kvk_transfer?: boolean
  transfer_alliance?: string
  transfer_rally_leader?: string
  // Rally-fill helpers (FIX 3) populated server-side from member data so member
  // instructions can show "filling ~X of Y march slots". Not produced by the AI.
  _march_size?: number
  _available_joiner_space?: number
  _rally_incomplete?: boolean
}

export interface TransferRecommendation {
  player_name: string
  home_alliance: string
  recommended_alliance: string
  rally_leader: string
  strength_improvement: string
}

export interface BattlePlan {
  assignments: BattlePlanAssignment[]
  summary: string
  formations?: Record<string, string>
  joiner_stacking_advice?: string
  coverage_gaps: string[]
  backup_plan?: string
  warnings?: string[]
  transfer_recommendations?: TransferRecommendation[]
  // legacy field retained for older stored plans
  recommendations?: string[]
}

async function loadAttendingMembersWithScores(eventId: string) {
  const supabase = createServiceClient()

  // Load event type for weights
  const { data: event } = await supabase
    .from('events')
    .select('*, event_types(*)')
    .eq('id', eventId)
    .single()

  if (!event?.event_types) throw new Error('Event not found')

  const weights = event.event_types.scoring_weights as Record<string, Record<string, number>>

  // Load attending members with all their data
  const { data: availability } = await supabase
    .from('event_availability')
    .select(`
      *,
      members (
        *,
        member_combat_stats (*),
        member_heroes (
          *,
          heroes (*)
        ),
        member_scores (*)
      )
    `)
    .eq('event_id', eventId)
    .eq('will_attend', true)

  if (!availability) return { members: [], event, weights }

  const members = availability.map(a => {
    const m = a.members as any
    const stats = m.member_combat_stats?.[0]
    const heroData: MemberHeroData[] = (m.member_heroes || []).map((mh: any) => ({
      hero: mh.heroes,
      star_level: mh.star_level,
      star_shards: mh.star_shards,
      widget_level: mh.widget_level,
      widget_unlocked: mh.widget_unlocked,
      expedition_skill_levels: mh.expedition_skill_levels || {},
    }))

    const troopData: TroopData | null = m.troop_data || null

    const profile: MemberProfile = {
      id: m.id,
      power: m.power || 0,
      troopCount: m.troop_count || 0,
      marchSize: m.march_size || 0,
      rallyCapacity: m.rally_capacity || 0,
      primaryTroopType: (stats?.troop_type_primary || 'mixed') as any,
      heroes: heroData,
      troopData,
      combatStats: {
        infantryAttack: stats?.infantry_attack || 0,
        infantryDefense: stats?.infantry_defense || 0,
        infantryHealth: stats?.infantry_health || 0,
        infantryLethality: stats?.infantry_lethality || 0,
        cavalryAttack: stats?.cavalry_attack || 0,
        cavalryDefense: stats?.cavalry_defense || 0,
        cavalryHealth: stats?.cavalry_health || 0,
        cavalryLethality: stats?.cavalry_lethality || 0,
        archerAttack: stats?.archer_attack || 0,
        archerDefense: stats?.archer_defense || 0,
        archerHealth: stats?.archer_health || 0,
        archerLethality: stats?.archer_lethality || 0,
      },
    }

    const scores = calculateRoleScores(profile, weights)
    const heroScore = calculateHeroScore(heroData)
    const heroSummary = buildHeroDetail(heroData)

    const effectiveStrength = troopData ? calculateEffectiveTroopStrength(troopData) : (m.troop_count || 0)

    return {
      member_id: m.id,
      player_name: m.player_name,
      power: m.power,
      march_size: m.march_size,
      rally_capacity: m.rally_capacity,
      troop_count: m.troop_count,
      effective_troop_strength: Math.round(effectiveStrength),
      troop_type: stats?.troop_type_primary || 'unknown',
      troop_data: troopData,
      hero_score: heroScore,
      heroes_detail: heroSummary.detail,
      has_combat_heroes: heroSummary.hasCombat,
      scores,
      available_from: a.available_from_utc,
      available_to: a.available_to_utc,
      squad_preference: a.squad_preference,
    }
  })

  return { members, event, weights }
}

// Strip characters from free-text member fields (player names, hero notes, etc.)
// that could corrupt the prompt's line structure or the JSON the model is asked
// to mirror back: control chars, then escape backslashes and double quotes.
function sanitizeForJson(str: string): string {
  if (!str) return ''
  return String(str)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

/**
 * FIX 1 — strip any "widget Lv N" mention from a free-text narrative string.
 * Joiners get ZERO widget benefit, so the AI must never present a joiner's widget
 * level as a contribution. Matches "widget Lv3", "widget Lv. 3", "widget Level 3",
 * "widget lvl 3", with an optional leading comma / wrapping parens, then tidies up
 * the leftover punctuation/whitespace.
 */
function stripWidgetMention(text: string | null | undefined): string {
  if (!text) return text || ''
  return String(text)
    // ", widget Lv3" / " (widget Level 3)" / "widget lvl. 3" → removed
    .replace(/[,;]?\s*\(?\s*widget\s*(?:lv|lvl|level)\.?\s*\d+\s*\)?/gi, '')
    // collapse artifacts left behind: " ()" , doubled spaces, space-before-punct
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()
}

/**
 * FIX 1 — post-processing pass that runs AFTER the AI reply is parsed and BEFORE
 * assignments are saved. Removes any joiner widget-level references the model may
 * have written into joiner narrative (reasoning / hero_recommendation) and the
 * shared joiner_stacking_advice. Rally/garrison LEADERS are left untouched —
 * their widgets are real.
 */
function sanitizeJoinerWidgetMentions(plan: BattlePlan): void {
  const isLeaderRole = (role?: string | null) => {
    const r = (role || '').toLowerCase()
    return r.includes('leader') || r === 'garrison'
  }
  for (const a of plan.assignments || []) {
    if (isLeaderRole(a.role)) continue
    if (a.reasoning) a.reasoning = stripWidgetMention(a.reasoning)
    if (a.hero_recommendation) a.hero_recommendation = stripWidgetMention(a.hero_recommendation)
  }
  // The joiner stacking advice is joiner-focused; scrub it too.
  if (plan.joiner_stacking_advice) plan.joiner_stacking_advice = stripWidgetMention(plan.joiner_stacking_advice)
}

// Hard cap on prompt size. If the member list would push past this, we drop
// members from the tail until it fits and tell the model the list was truncated.
const MAX_PROMPT_CHARS = 80000

function buildPlanningPrompt(members: any[], event: any, kvkOptions?: { planMode?: 'A' | 'B' }): string {
  const eventType = event.event_types
  const rules = eventType.rules
  const objectives = eventType.objectives
  const planMode = kvkOptions?.planMode

  // Single-alliance Castle Battle: castle is top priority over the four turrets.
  const castleBattleBlock = eventType.slug === 'castle_battle'
    ? `\nCASTLE BATTLE PRIORITY: This is a single-alliance Castle Battle. Castle is top priority — assign the 2 strongest rally leaders and best joiners to castle first. If insufficient players for all 5 structures, fill castle completely first, then assign remaining capacity to turrets starting with North, then East, South, West. Never leave castle understaffed to fill turrets. Use squad values: castle, north_turret, east_turret, south_turret, west_turret, support. The battle window is 12:00–17:00 UTC.\n`
    : ''

  const planModeBlock = planMode === 'A'
    ? `\nKVK PLAN MODE: PLAN A — ALLIANCE ONLY.
STRICT rule: every rally joiner MUST be from the SAME alliance as their rally leader. Do NOT assign any cross-alliance joiners even if a member is willing to move. Set kvk_transfer = false on every assignment and return an empty transfer_recommendations array.\n`
    : planMode === 'B'
    ? `\nKVK PLAN MODE: PLAN B — OPTIMAL (INCLUDES WILLING TRANSFERS).
You MAY assign willing-to-move members (kvk_willing_to_move = true) to join a rally leader from a DIFFERENT alliance when it meaningfully improves rally strength. For each such cross-alliance joiner set kvk_transfer = true, transfer_alliance = the rally leader's alliance, and transfer_rally_leader = the rally leader's player name. Also populate transfer_recommendations with one entry per transferred player: { player_name, home_alliance, recommended_alliance, rally_leader, strength_improvement }. Members who are NOT willing to move must still only join same-alliance rally leaders.\n`
    : ''

  const header = `You are a battle planning assistant for the mobile strategy game Kingshot.
${planModeBlock}${castleBattleBlock}

EVENT: ${eventType.name}
DESCRIPTION: ${eventType.description}
OBJECTIVES: ${JSON.stringify(objectives)}
KEY RULES: ${JSON.stringify(rules.key_rules || [])}
EVENT RULES: ${JSON.stringify(rules)}

ATTENDING MEMBERS (${members.length} total):`

  // Build each member's block separately so we can drop blocks from the tail if
  // the prompt would exceed MAX_PROMPT_CHARS. All free-text fields are sanitized.
  const memberBlocks = members.map(m => {
    const troopBreakdown = m.troop_data
      ? (['infantry', 'cavalry', 'archer'] as const).map(type => {
          const typeData = m.troop_data[type]
          if (!typeData || typeof typeData !== 'object') return null
          const tgLevel = Number(typeData.tg_level) || 0
          const tiers = Object.keys(TIER_POWER)
            .map(tier => {
              const v = Number(typeData[tier] ?? typeData[tier.toUpperCase()]) || 0
              return v > 0 ? `${tier.toUpperCase()}=${v.toLocaleString()}` : null
            })
            .filter(Boolean)
            .reverse() // show T10 first
          if (!tiers.length && tgLevel === 0) return null
          const eff = calculateEffectiveTroopStrength(m.troop_data, type)
          return `    ${type}: TG${tgLevel}${tiers.length ? ` | ${tiers.join(', ')}` : ''} (eff: ${Math.round(eff).toLocaleString()})`
        }).filter(Boolean).join('\n')
      : null

    const heroesDetail = m.heroes_detail && m.heroes_detail.length
      ? m.heroes_detail.map((h: string) => sanitizeForJson(h)).join('; ')
      : 'none entered'

    return `
- Player: ${sanitizeForJson(m.player_name)}
  ID: ${m.member_id}${m.alliance_name ? `\n  Alliance: [${sanitizeForJson(m.alliance_tag || '')}] ${sanitizeForJson(m.alliance_name)}` : ''}${m.kvk_willing_to_move !== undefined ? `\n  KVK Willing To Move: ${m.kvk_willing_to_move ? 'YES (may join a different alliance\'s rally)' : 'no (same-alliance rallies only)'}` : ''}
  Power: ${m.power.toLocaleString()}
  March Size: ${m.march_size.toLocaleString()}
  Rally Capacity: ${m.rally_capacity.toLocaleString()}
  Rally Fill Math: rally_cap=${(m.rally_capacity || 0).toLocaleString()}, march=${(m.march_size || 0).toLocaleString()}, available_joiner_space=${Math.max(0, (m.rally_capacity || 0) - (m.march_size || 0)).toLocaleString()}
  Troop Count: ${m.troop_count.toLocaleString()} | Effective Strength: ${m.effective_troop_strength.toLocaleString()}
  Primary Troop Type: ${sanitizeForJson(m.troop_type)}${troopBreakdown ? `\n  Troop Breakdown:\n${troopBreakdown}` : ''}
  Hero Score: ${m.hero_score.toFixed(1)}
  Combat Heroes: ${heroesDetail}${!m.has_combat_heroes ? '\n  ⚠ No combat heroes entered — battle plan recommendations will be limited' : ''}
  Role Scores: Rally Leader=${m.scores.rallyLeader.toFixed(2)}, Joiner=${m.scores.joiner.toFixed(2)}, Castle=${m.scores.castle.toFixed(2)}, Turret=${m.scores.turret.toFixed(2)}, Support=${m.scores.support.toFixed(2)}
  Available: ${m.available_from || 'all event'} to ${m.available_to || 'all event'}
  Squad Preference: ${sanitizeForJson(m.squad_preference || 'none')}`
  })

  const footer = `

INSTRUCTIONS:
1. Assign every attending member a primary role and squad (if applicable)
2. Designate backup players for critical roles (rally leaders especially)
3. Explain WHY each assignment was made — reference specific stats AND hero/effect_op synergy
4. Identify coverage gaps (time windows with insufficient players, missing backups)
5. For Swordland: fill Squad A and Squad B with 30 members each, 10 substitutes
6. For KVK Castle Battle: STAFF THE CASTLE FIRST — holding it 151 consecutive minutes wins instantly. Assign the strongest rally leader and the highest-scoring joiners to the castle before anyone else, then fill the 4 turret teams (N/E/S/W) by turret score, then support with whoever remains. Include a rotation schedule.
6b. For (single-alliance) Castle Battle: STAFF THE CASTLE FIRST with the 2 strongest rally leaders and best joiners (2 full castle teams). Only after the castle is fully staffed, fill turrets in order North → East → South → West with remaining capacity, then support. Never leave the castle understaffed to fill a turret. Battle window is 12:00–17:00 UTC.
7. For Tri Alliance Clash: assign by phase (Seize, Garrison, Temple) with defenders and assault teams
8. Match march size to rally capacity — don't exceed rally capacity with joiners

Respond ONLY with valid JSON in this exact schema (raw JSON, no code fences):
{
  "summary": "2-3 sentence overview of the plan",
  "formations": {
    "attack_standard": "50% Infantry / 20% Cavalry / 30% Archer",
    "defense_standard": "60% Infantry / 20% Cavalry / 20% Archer"
  },
  "assignments": [
    {
      "member_id": "uuid",
      "player_name": "name",
      "role": "rally_leader|joiner|garrison|support|backup_leader|backup_joiner",
      "squad": "A|B|castle|north_turret|east_turret|south_turret|west_turret|support|null",
      "formation_recommendation": "50% Infantry / 20% Cavalry / 30% Archer",
      "hero_recommendation": "Lead with X (offensive widget); bring Y + Z as lineup",
      "reasoning": "Specific explanation referencing their stats and hero synergy",
      "is_primary": true,
      "is_backup": false,
      "time_window": "full_event|12:00-14:00 UTC|etc"
    }
  ],
  "joiner_stacking_advice": "Optimal joiner hero combinations for this rally",
  "coverage_gaps": ["Time windows or roles with insufficient coverage"],
  "backup_plan": "What happens when primary players rotate out",
  "warnings": ["Players with missing stats that reduce plan accuracy"]
}`

  // Assemble, dropping members from the tail until the prompt fits the cap.
  const compose = (blocks: string[], omitted: number) => {
    const note = omitted > 0
      ? `\n\n[NOTE: member list truncated to fit context limit — showing ${blocks.length} of ${members.length} members; ${omitted} omitted]`
      : ''
    return `${header}${blocks.join('')}${note}${footer}`
  }

  let blocks = memberBlocks
  let prompt = compose(blocks, 0)
  while (prompt.length > MAX_PROMPT_CHARS && blocks.length > 1) {
    const drop = Math.max(1, Math.floor(blocks.length * 0.1))
    blocks = blocks.slice(0, blocks.length - drop)
    prompt = compose(blocks, memberBlocks.length - blocks.length)
  }
  return prompt
}

async function storeAssignments(eventId: string, plan: BattlePlan, event: any, members: any[] = []) {
  const supabase = createServiceClient()

  // FIX 3 — annotate assignments with march/rally-fill data for member instructions.
  attachRallyFillData(plan, members)

  // Clear existing assignments
  await supabase.from('event_assignments').delete().eq('event_id', eventId)

  const eventName = event.name || event.event_types?.name || 'Battle Event'
  const eventStartUtc = event.battle_start_utc || null
  const now = new Date().toISOString()

  // Insert new assignments. The model may return richer fields
  // (formation_recommendation, hero_recommendation, time_window) than the
  // event_assignments table has columns for — fold those into `reasoning`.
  const rows = plan.assignments.map(a => {
    const extras = [
      a.hero_recommendation ? `Heroes: ${a.hero_recommendation}` : '',
      a.formation_recommendation ? `Formation: ${a.formation_recommendation}` : '',
      a.time_window && !a.time_window_start ? `Window: ${a.time_window}` : '',
    ].filter(Boolean).join(' · ')
    const reasoning = [a.reasoning, extras].filter(Boolean).join(' — ')
    const memberInstructions = generateMemberInstructions(a, plan, eventName, eventStartUtc)
    return {
      event_id: eventId,
      member_id: a.member_id,
      role: a.role,
      squad: a.squad,
      is_primary: a.is_primary,
      is_backup: a.is_backup,
      reasoning,
      time_window_start: a.time_window_start || null,
      time_window_end: a.time_window_end || null,
      member_instructions: memberInstructions,
      instruction_generated_at: now,
    }
  })

  await supabase.from('event_assignments').insert(rows)

  // Store the full plan in the event
  await supabase
    .from('events')
    .update({ battle_plan: plan as any })
    .eq('id', eventId)
}

function extractJSON(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in response')
  return text.slice(start, end + 1)
}

/**
 * Run the battle-planner model for a given prompt and parse its JSON reply.
 *
 * Both failure modes are handled so a bad run surfaces a clear message instead of
 * crashing the request:
 *  - the Claude API call itself (network / rate limit / API error)
 *  - parsing the model's JSON reply. The original "Expected ',' or ']' ... at
 *    position N" crash came from here: when the reply is cut off at the output
 *    token limit (stop_reason === 'max_tokens') the JSON is truncated mid-array.
 */
async function runPlannerModel(prompt: string): Promise<BattlePlan> {
  let response: any
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      system: BATTLE_PLANNER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err: any) {
    console.error('[BattlePlan] Claude API request failed:', err?.message || err)
    throw new Error(`Battle plan service is temporarily unavailable (${err?.message || 'AI request failed'}). Please try again.`)
  }

  const text = response?.content?.[0]?.type === 'text' ? response.content[0].text : ''
  const stopReason = response?.stop_reason

  let jsonStr: string
  try {
    jsonStr = extractJSON(text)
  } catch {
    console.error('[BattlePlan] No JSON object found in model reply. stop_reason=', stopReason, 'length=', text.length)
    throw new Error('The battle planner returned an unreadable response (no JSON found). Please try generating the plan again.')
  }

  try {
    const parsed = JSON.parse(jsonStr) as BattlePlan
    // FIX 1 — scrub joiner widget mentions from all narrative before it is stored.
    sanitizeJoinerWidgetMentions(parsed)
    return parsed
  } catch (err: any) {
    // A truncated reply (hit the output token limit) is the most common cause.
    const hint = stopReason === 'max_tokens'
      ? ' The response was cut off at the output limit — try again, or reduce the number of attending members.'
      : ' Please try generating the plan again.'
    console.error('[BattlePlan] Failed to parse model JSON:', err?.message, '| stop_reason=', stopReason, '| length=', jsonStr.length)
    throw new Error(`The battle planner returned malformed JSON (${err?.message || 'parse error'}).${hint}`)
  }
}

/**
 * Load the given (attending) members, scored with the KVK Castle weights, folding
 * in each member's availability window from the supplied map.
 */
async function loadKvkMembersForScoring(memberIds: string[], eventType: any, availabilityMap: Record<string, any>) {
  const supabase = createServiceClient()
  const weights = eventType.scoring_weights as Record<string, Record<string, number>>

  // `members` has two FKs to `alliances` (alliance_id + previous_alliance_id), so
  // a bare `alliances(...)` embed is ambiguous and fails the whole query (data=null
  // → "No attending members found"). Disambiguate with the explicit FK name.
  const { data: rawMembers, error } = await supabase
    .from('members')
    .select(`
      *,
      alliances!members_alliance_id_fkey ( name, tag ),
      member_combat_stats (*),
      member_heroes ( *, heroes (*) ),
      member_scores (*)
    `)
    .in('id', memberIds)

  if (error) {
    console.error('[KVK] loadKvkMembersForScoring query FAILED:', error.message, error.details || '', error.hint || '')
  }

  return (rawMembers || []).map(m => {
    const stats = (m.member_combat_stats as any)?.[0]
    const heroData: MemberHeroData[] = (m.member_heroes || []).map((mh: any) => ({
      hero: mh.heroes,
      star_level: mh.star_level,
      star_shards: mh.star_shards,
      widget_level: mh.widget_level,
      widget_unlocked: mh.widget_unlocked,
      expedition_skill_levels: mh.expedition_skill_levels || {},
    }))
    const troopData: TroopData | null = m.troop_data || null

    const profile: MemberProfile = {
      id: m.id,
      power: m.power || 0,
      troopCount: m.troop_count || 0,
      marchSize: m.march_size || 0,
      rallyCapacity: m.rally_capacity || 0,
      primaryTroopType: (stats?.troop_type_primary || 'mixed') as any,
      heroes: heroData,
      troopData,
      combatStats: {
        infantryAttack: stats?.infantry_attack || 0,
        infantryDefense: stats?.infantry_defense || 0,
        infantryHealth: stats?.infantry_health || 0,
        infantryLethality: stats?.infantry_lethality || 0,
        cavalryAttack: stats?.cavalry_attack || 0,
        cavalryDefense: stats?.cavalry_defense || 0,
        cavalryHealth: stats?.cavalry_health || 0,
        cavalryLethality: stats?.cavalry_lethality || 0,
        archerAttack: stats?.archer_attack || 0,
        archerDefense: stats?.archer_defense || 0,
        archerHealth: stats?.archer_health || 0,
        archerLethality: stats?.archer_lethality || 0,
      },
    }

    const scores = calculateRoleScores(profile, weights)
    const heroScore = calculateHeroScore(heroData)
    const heroSummary = buildHeroDetail(heroData)
    const effectiveStrength = troopData ? calculateEffectiveTroopStrength(troopData) : (m.troop_count || 0)
    const a = availabilityMap[m.id]

    return {
      member_id: m.id,
      player_name: m.player_name,
      alliance_id: m.alliance_id || null,
      alliance_name: (m.alliances as any)?.name || null,
      alliance_tag: (m.alliances as any)?.tag || null,
      kvk_willing_to_move: !!m.kvk_willing_to_move,
      power: m.power,
      march_size: m.march_size,
      rally_capacity: m.rally_capacity,
      troop_count: m.troop_count,
      effective_troop_strength: Math.round(effectiveStrength),
      troop_type: stats?.troop_type_primary || 'unknown',
      troop_data: troopData,
      hero_score: heroScore,
      heroes_detail: heroSummary.detail,
      has_combat_heroes: heroSummary.hasCombat,
      scores,
      available_from: a?.available_from_utc || null,
      available_to: a?.available_to_utc || null,
      squad_preference: a?.squad_preference || null,
    }
  })
}

/**
 * Store a kingdom KVK plan by routing each member's assignment to THEIR alliance's
 * active KVK event (so alliance-scoped RLS lets the member see it). Preserves any
 * manual overrides by skipping members that aren't in the plan, and regenerates
 * member_instructions for each AI assignment.
 */
/**
 * FIX 2 — a cross-alliance transfer is only legitimate when the joiner's rally
 * leader is in a DIFFERENT alliance. The model sometimes flags a transfer even
 * when the rally leader is in the joiner's own alliance (e.g. recommending a TNT
 * member move to HXA to join a leader who is themselves in TNT). This clears
 * those false transfers and prunes matching transfer_recommendations.
 */
function reconcileTransfers(plan: BattlePlan, members: any[]) {
  const allianceById: Record<string, string | null> = {}
  for (const m of members) allianceById[m.member_id] = m.alliance_id || null

  // The (non-backup) rally leader assigned to each squad.
  const leaderBySquad: Record<string, any> = {}
  for (const a of plan.assignments) {
    if (a.squad && a.role?.toLowerCase().includes('leader') && !a.is_backup) {
      leaderBySquad[a.squad] = a
    }
  }

  for (const a of plan.assignments) {
    if (!a.kvk_transfer) continue
    const joinerAlliance = allianceById[a.member_id]

    // Resolve the rally leader's alliance: prefer the leader assigned to the same
    // squad; fall back to matching transfer_rally_leader by player name.
    let leaderAlliance: string | null = null
    const squadLeader = a.squad ? leaderBySquad[a.squad] : null
    if (squadLeader) leaderAlliance = allianceById[squadLeader.member_id] ?? null
    if (!leaderAlliance && a.transfer_rally_leader) {
      const lm = members.find(m => m.player_name === a.transfer_rally_leader)
      if (lm) leaderAlliance = lm.alliance_id || null
    }

    // Same alliance → no transfer needed: assign as a normal joiner.
    if (joinerAlliance && leaderAlliance && joinerAlliance === leaderAlliance) {
      a.kvk_transfer = false
      delete a.transfer_alliance
      delete a.transfer_rally_leader
    }
  }

  // Drop transfer recommendations that are same-alliance or no longer back a
  // flagged transfer assignment.
  if (Array.isArray(plan.transfer_recommendations)) {
    plan.transfer_recommendations = plan.transfer_recommendations.filter(t => {
      const home = (t.home_alliance || '').trim().toLowerCase()
      const rec = (t.recommended_alliance || '').trim().toLowerCase()
      if (home && rec && home === rec) return false
      return plan.assignments.some(a => a.kvk_transfer && a.player_name === t.player_name)
    })
  }
}

/**
 * FIX 3 — annotate each assignment with the data needed for capacity-aware member
 * instructions: the player's own march_size, and (for rally leaders) the space
 * available to joiners (rally_capacity - march_size). Incomplete leader data is
 * flagged so instructions fall back to the "max 15 joiners" guidance.
 */
function attachRallyFillData(plan: BattlePlan, members: any[]) {
  const byId: Record<string, any> = {}
  for (const m of members) byId[m.member_id] = m

  for (const a of plan.assignments) {
    const m = byId[a.member_id]
    a._march_size = Number(m?.march_size) || 0

    if (a.role?.toLowerCase().includes('leader') && !a.is_backup) {
      const cap = Number(m?.rally_capacity) || 0
      const march = Number(m?.march_size) || 0
      if (!cap || !march) {
        a._rally_incomplete = true
        a._available_joiner_space = 0
      } else {
        a._available_joiner_space = Math.max(0, cap - march)
      }
    }
  }
}

async function storeKvkAssignments(
  plan: BattlePlan,
  eventIdByMember: Record<string, string>,
  eventName: string,
  eventStartByMember: Record<string, string | null>,
  members: any[] = [],
) {
  attachRallyFillData(plan, members)

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Group assignment rows by the member's alliance event.
  const rowsByEvent: Record<string, any[]> = {}
  for (const a of plan.assignments) {
    const eventId = eventIdByMember[a.member_id]
    if (!eventId) continue // member not attending an active event — skip
    const extras = [
      a.hero_recommendation ? `Heroes: ${a.hero_recommendation}` : '',
      a.formation_recommendation ? `Formation: ${a.formation_recommendation}` : '',
      a.time_window && !a.time_window_start ? `Window: ${a.time_window}` : '',
    ].filter(Boolean).join(' · ')
    const reasoning = [a.reasoning, extras].filter(Boolean).join(' — ')
    const memberInstructions = generateMemberInstructions(a, plan, eventName, eventStartByMember[a.member_id] || null)
    ;(rowsByEvent[eventId] ||= []).push({
      event_id: eventId,
      member_id: a.member_id,
      role: a.role,
      squad: a.squad,
      rally_number: (a as any).rally_number ?? null,
      is_primary: a.is_primary,
      is_backup: a.is_backup,
      reasoning,
      time_window_start: a.time_window_start || null,
      time_window_end: a.time_window_end || null,
      member_instructions: memberInstructions,
      instruction_generated_at: now,
      kvk_transfer: !!a.kvk_transfer,
      transfer_alliance: a.transfer_alliance || null,
      transfer_rally_leader: a.transfer_rally_leader || null,
    })
  }

  for (const [eventId, rows] of Object.entries(rowsByEvent)) {
    // Replace the AI-generated assignments for this event, then store the plan on it.
    await supabase.from('event_assignments').delete().eq('event_id', eventId)
    await supabase.from('event_assignments').insert(rows)
    await supabase.from('events').update({ battle_plan: plan as any }).eq('id', eventId)
  }
}

/**
 * FIX 2 — DETERMINISTIC KVK structure assignment order.
 *
 * WHO goes WHERE is decided entirely by this code, NOT the AI. The AI is used only
 * for narrative text and member instructions (merged in afterwards).
 *
 * Strict leader order (by score, across ALL participating alliances):
 *   1 Castle Rally 1, 2 Castle Rally 2, 3 North, 4 East, 5 South, 6 West turret.
 * Then joiners fill each structure to capacity (rally_capacity - march_size,
 * largest march first, max 15 when data is missing) BEFORE moving to the next:
 *   Castle 1 → Castle 2 → North → East → South → West → everyone else to Support.
 * Plan A: joiners must match their leader's alliance. Plan B: any alliance (a
 * cross-alliance joiner is flagged kvk_transfer + a transfer recommendation).
 */
const KVK_LEADER_SLOTS: { squad: string; rally_number: number; label: string; formation: string }[] = [
  { squad: 'castle', rally_number: 1, label: 'Castle Rally 1', formation: '60% Infantry / 20% Cavalry / 20% Archer (garrison)' },
  { squad: 'castle', rally_number: 2, label: 'Castle Rally 2', formation: '60% Infantry / 20% Cavalry / 20% Archer (garrison)' },
  { squad: 'north_turret', rally_number: 1, label: 'North Turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { squad: 'east_turret', rally_number: 1, label: 'East Turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { squad: 'south_turret', rally_number: 1, label: 'South Turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
  { squad: 'west_turret', rally_number: 1, label: 'West Turret', formation: '50% Infantry / 20% Cavalry / 30% Archer (rally)' },
]

function memberRankScore(m: any): number {
  // Strongest player overall. scores.overall is the max of all role scores; fall
  // back to raw power so members without computed scores still rank.
  return Number(m?.scores?.overall) || Number(m?.power) || 0
}

export function enforceKvkAssignmentOrder(
  attendingMembers: any[],
  planMode: 'A' | 'B' = 'A',
): { assignments: BattlePlanAssignment[]; transfer_recommendations: TransferRecommendation[] } {
  const ranked = [...attendingMembers].sort(
    (a, b) => memberRankScore(b) - memberRankScore(a) || (Number(b.power) || 0) - (Number(a.power) || 0)
  )

  const assignments: BattlePlanAssignment[] = []
  const transfers: TransferRecommendation[] = []
  const used = new Set<string>()

  const allianceLabel = (m: any) => m?.alliance_tag || m?.alliance_name || ''

  // 1. Assign the top scorers as leaders in the strict slot order.
  const leaders: { slot: typeof KVK_LEADER_SLOTS[number]; member: any }[] = []
  for (let i = 0; i < KVK_LEADER_SLOTS.length && i < ranked.length; i++) {
    const slot = KVK_LEADER_SLOTS[i]
    const m = ranked[i]
    used.add(m.member_id)
    leaders.push({ slot, member: m })
    assignments.push({
      member_id: m.member_id,
      player_name: m.player_name,
      role: 'rally_leader',
      squad: slot.squad,
      rally_number: slot.rally_number,
      is_primary: true,
      is_backup: false,
      reasoning: '',
      formation_recommendation: slot.formation,
    } as BattlePlanAssignment)
  }

  // 2. Joiner pool — everyone not a leader, largest march first.
  const pool = ranked
    .filter(m => !used.has(m.member_id))
    .sort((a, b) => (Number(b.march_size) || 0) - (Number(a.march_size) || 0))

  // 3. Fill each leader's structure COMPLETELY before moving to the next.
  for (const { slot, member: leader } of leaders) {
    const cap = Number(leader.rally_capacity) || 0
    const march = Number(leader.march_size) || 0
    const incomplete = !cap || !march
    let space = incomplete ? DEFAULT_CAPACITY : Math.max(0, cap - march)
    const maxJoiners = incomplete ? MAX_JOINERS_PER_RALLY : Number.POSITIVE_INFINITY
    let count = 0

    while (count < maxJoiners) {
      // Pick the largest-march eligible joiner that still fits (pool is sorted desc,
      // so a smaller later joiner can top off the remaining space).
      let idx = -1
      for (let k = 0; k < pool.length; k++) {
        const j = pool[k]
        if (planMode === 'A' && j.alliance_id !== leader.alliance_id) continue
        const jm = Number(j.march_size) || MARCH_ESTIMATE
        if (!incomplete && jm > space) continue
        idx = k
        break
      }
      if (idx === -1) break

      const j = pool.splice(idx, 1)[0]
      used.add(j.member_id)
      space -= Number(j.march_size) || MARCH_ESTIMATE
      count++

      const crossAlliance = planMode === 'B' && j.alliance_id !== leader.alliance_id
      const isTurret = slot.squad !== 'castle'
      assignments.push({
        member_id: j.member_id,
        player_name: j.player_name,
        role: isTurret ? 'turret_joiner' : 'joiner',
        squad: slot.squad,
        rally_number: slot.rally_number,
        is_primary: true,
        is_backup: false,
        reasoning: '',
        formation_recommendation: slot.formation,
        kvk_transfer: crossAlliance,
        transfer_alliance: crossAlliance ? allianceLabel(leader) : undefined,
        transfer_rally_leader: crossAlliance ? leader.player_name : undefined,
      } as BattlePlanAssignment)

      if (crossAlliance) {
        transfers.push({
          player_name: j.player_name,
          home_alliance: allianceLabel(j),
          recommended_alliance: allianceLabel(leader),
          rally_leader: leader.player_name,
          strength_improvement: `Joins ${slot.label} to fill it to capacity`,
        })
      }
    }
  }

  // 4. Everyone left → Support.
  for (const m of pool) {
    assignments.push({
      member_id: m.member_id,
      player_name: m.player_name,
      role: 'support',
      squad: 'support',
      rally_number: null,
      is_primary: true,
      is_backup: false,
      reasoning: '',
    } as BattlePlanAssignment)
  }

  return { assignments, transfer_recommendations: transfers }
}

/**
 * Generate a kingdom-wide KVK Castle battle plan from ONLY the attending members
 * (will_attend = true) across every participating alliance's active KVK event,
 * honouring each member's availability window. Each assignment is stored on the
 * member's own alliance event. Returns the plan and the affected event ids.
 */
export async function generateKingdomKvkBattlePlan(kingdomId: string, planMode: 'A' | 'B' = 'A'): Promise<{ plan: BattlePlan; eventIds: string[] }> {
  const { eventType, alliances } = await getKvkContext(kingdomId)
  if (!eventType) throw new Error('KVK Castle Battle event type is not configured. Run the schema seed data.')

  const active = alliances.filter(a => a.activeEvent)
  if (active.length === 0) {
    throw new Error('No alliance has an active KVK Castle Battle event. Create one and collect attendance first.')
  }

  const activeEventIds = active.map(a => a.activeEvent.id)
  const eventStartById: Record<string, string | null> = {}
  for (const a of active) eventStartById[a.activeEvent.id] = a.activeEvent.battle_start_utc || null

  // Pull confirmed attendees + availability across all active events.
  const supabase = createServiceClient()
  const { data: avail } = await supabase
    .from('event_availability')
    .select('*')
    .in('event_id', activeEventIds)
    .eq('will_attend', true)

  const attendees = avail || []
  if (attendees.length === 0) {
    throw new Error('No members have confirmed attendance on the KVK events yet.')
  }

  const memberIds = attendees.map(a => a.member_id)
  const availByMember: Record<string, any> = {}
  const eventIdByMember: Record<string, string> = {}
  const eventStartByMember: Record<string, string | null> = {}
  for (const a of attendees) {
    availByMember[a.member_id] = a
    eventIdByMember[a.member_id] = a.event_id
    eventStartByMember[a.member_id] = eventStartById[a.event_id] || null
  }

  const members = await loadKvkMembersForScoring(memberIds, eventType, availByMember)
  if (members.length === 0) throw new Error('No attending members found.')

  // buildPlanningPrompt only needs event.event_types and event.name/battle_start_utc.
  const pseudoEvent = {
    name: 'Kingdom KVK Castle Battle',
    battle_start_utc: active[0].activeEvent.battle_start_utc || null,
    event_types: eventType,
  }
  const prompt = buildPlanningPrompt(members, pseudoEvent, { planMode })

  // The AI plan is used ONLY for narrative (summary, formations, per-member
  // reasoning/hero advice, coverage gaps, etc.). Structure placement is decided
  // deterministically below (FIX 2).
  const aiPlan: BattlePlan = await runPlannerModel(prompt)

  // FIX 2 — deterministic structure assignment order REPLACES the AI's WHO-goes-WHERE.
  const { assignments, transfer_recommendations } = enforceKvkAssignmentOrder(members, planMode)

  // Merge the AI's narrative back onto each deterministic assignment by member id.
  const aiByMember: Record<string, BattlePlanAssignment> = {}
  for (const a of aiPlan.assignments || []) aiByMember[a.member_id] = a
  for (const a of assignments) {
    const ai = aiByMember[a.member_id]
    if (ai) {
      a.reasoning = stripWidgetMention(ai.reasoning) || a.reasoning
      a.hero_recommendation = stripWidgetMention(ai.hero_recommendation) || undefined
      if (ai.formation_recommendation) a.formation_recommendation = ai.formation_recommendation
      a.time_window = ai.time_window
    }
    if (!a.reasoning) {
      a.reasoning = `Assigned to ${(a.squad || 'support').replace(/_/g, ' ')} as ${a.role.replace(/_/g, ' ')} by KVK deterministic order (ranked by score${a.kvk_transfer ? '; cross-alliance transfer to fill the rally' : ''}).`
    }
  }

  const plan: BattlePlan = {
    ...aiPlan,
    assignments,
    transfer_recommendations: planMode === 'B' ? transfer_recommendations : [],
  }

  await storeKvkAssignments(plan, eventIdByMember, pseudoEvent.name, eventStartByMember, members)

  // FEATURE 3 — pre-populate the castle positioning map from these assignments.
  try {
    await autoPopulateCityAssignments(kingdomId)
  } catch (err: any) {
    console.error('[KVK] autoPopulateCityAssignments failed (non-fatal):', err?.message || err)
  }

  return { plan, eventIds: activeEventIds }
}

async function planOneLegion(legion: 'legion1' | 'legion2', members: any[], event: any): Promise<BattlePlan | null> {
  if (members.length === 0) return null
  const label = legion === 'legion1' ? 'Legion 1' : 'Legion 2'
  const prompt = buildPlanningPrompt(members, event) +
    `\n\nIMPORTANT: This plan is for ${label} ONLY. These ${members.length} members all fight together in ${label}. Set "squad": "${legion}" on every assignment.`

  const plan: BattlePlan = await runPlannerModel(prompt)
  // Force the squad to the legion regardless of what the model returned.
  for (const a of plan.assignments) a.squad = legion
  return plan
}

/**
 * Swordland Showdown: generate a SEPARATE battle plan for each legion, then merge
 * them into one stored plan. Members are split by their squad_preference
 * ('legion1' / 'legion2'); anyone attending without a chosen legion is folded into
 * Legion 1 so they still receive an assignment (leaders can move them after).
 */
async function generateSwordlandPlan(members: any[], event: any, eventId: string): Promise<BattlePlan> {
  const legion2 = members.filter(m => m.squad_preference === 'legion2')
  const legion1 = members.filter(m => m.squad_preference !== 'legion2') // includes legion1 + unspecified

  const [p1, p2] = await Promise.all([
    planOneLegion('legion1', legion1, event),
    planOneLegion('legion2', legion2, event),
  ])

  const merged: BattlePlan = {
    summary: [
      p1?.summary ? `Legion 1: ${p1.summary}` : '',
      p2?.summary ? `Legion 2: ${p2.summary}` : '',
    ].filter(Boolean).join('\n\n') || 'No members assigned to either legion yet.',
    assignments: [...(p1?.assignments || []), ...(p2?.assignments || [])],
    formations: { ...(p1?.formations || {}), ...(p2?.formations || {}) },
    joiner_stacking_advice: [p1?.joiner_stacking_advice, p2?.joiner_stacking_advice].filter(Boolean).join(' | ') || undefined,
    coverage_gaps: [
      ...(p1?.coverage_gaps || []).map(g => `Legion 1: ${g}`),
      ...(p2?.coverage_gaps || []).map(g => `Legion 2: ${g}`),
    ],
    backup_plan: [p1?.backup_plan, p2?.backup_plan].filter(Boolean).join(' | ') || undefined,
    warnings: [...(p1?.warnings || []), ...(p2?.warnings || [])],
  }

  await storeAssignments(eventId, merged, event, members)
  return merged
}

export async function generateBattlePlan(eventId: string): Promise<BattlePlan> {
  const { members, event } = await loadAttendingMembersWithScores(eventId)

  if (members.length === 0) {
    throw new Error('No attending members found for this event')
  }

  // Swordland Showdown runs two legions at different times — plan each separately.
  if (event.event_types?.slug === 'swordland_showdown') {
    return generateSwordlandPlan(members, event, eventId)
  }

  const prompt = buildPlanningPrompt(members, event)

  const plan: BattlePlan = await runPlannerModel(prompt)

  await storeAssignments(eventId, plan, event, members)
  return plan
}

