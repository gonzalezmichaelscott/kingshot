// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateRoleScores, calculateHeroScore, calculateEffectiveTroopStrength, TIER_POWER } from '@/lib/scoring'
import type { MemberHeroData, MemberProfile, TroopData } from '@/lib/scoring'
import { generateMemberInstructions } from '@/lib/member-instructions'
import { getKvkContext } from '@/lib/kvk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BATTLE_PLANNER_SYSTEM_PROMPT = `You are an expert battle planner for the mobile strategy game Kingshot.

VERIFIED DAMAGE FORMULA (~100% accuracy, community-tested):
Kills = √Troops × (Attack × Lethality) / (Enemy Defense × Enemy Health) × SkillMod

CRITICAL RULES:
1. Attack and Lethality are EQUALLY important — they multiply together. Boost whichever is LOWER.
2. Troop count scales with SQUARE ROOT — 2M troops does NOT deal double the damage of 1M troops.
3. SkillMod (hero expedition skills) has the BIGGEST influence on battle outcome.
4. Hero diversity: different effect_op codes MULTIPLY (Chenko 101 + Amane 102 = 2.25x vs 4x same = 2.0x — 12.5% more damage from diversity alone).
5. Same effect_op codes ADD — diminishing returns on identical heroes.
6. NEVER reference Conquest skills in battle plans — they are Arena PvP only.
7. Widget boosts are MULTIPLICATIVE for rally/garrison leaders — prioritize widget-equipped leaders.
8. JOINERS: only first expedition skill of lead hero applies. Skills 2-4 are invisible when joining.
9. LEADERS: all expedition skills from all 3 heroes they bring apply.

TROOP COUNTER SYSTEM:
- Infantry counters Cavalry: 25-50% bonus damage (weak vs Archers)
- Cavalry counters Archers: 25-50% bonus damage (weak vs Infantry)
- Archers counter Infantry: 25-50% bonus damage (weak vs Cavalry)

OPTIMAL FORMATIONS:
- PvP Rally (attacking): 50% Infantry / 20% Cavalry / 30% Archer
- Bear Hunt: 5% Infantry / 15% Cavalry / 80% Archer (Archers are the primary DPS)
- Vikings: 65% Infantry / 35% Cavalry / 0% Archer
- KVK / Castle garrison (defending): 60% Infantry / 20% Cavalry / 20% Archer

RALLY LEADER SELECTION RULES:
- Must have march_size >= rally_capacity to fill the rally
- Offensive widget = highest priority (Amadeus is the ONLY offensive infantry widget in the game)
- Gen 1-2 attack: Amadeus (offensive widget), Marlin (archer)
- Gen 3+ attack: Petra (multiplicative whole-rally ATK buff — non-negotiable), Rosa, Long Fei, Vivian, Yang, Ava
- Zoe NEVER leads attack rallies — her kit is purely defensive
- Garrison/defense: Zoe, Jabel, Eric, Alcar, Charles (Gen 7)

CASTLE PRIORITY (KVK Castle Battle):
Holding the castle for 151 consecutive minutes wins the entire KVK instantly. ALWAYS assign the kingdom's strongest rally leaders and highest-scoring joiners to the castle FIRST. Only after the castle is fully staffed assign remaining players to turrets and support. Never sacrifice castle strength for turret assignments. Order of filling: (1) top rally leader to the castle, (2) fill castle joiner slots with the highest-scoring joiners, (3) assign remaining players to the four turrets by turret score, (4) everyone left becomes support.

RALLY JOINER RULE:
Joiners must be from the same alliance as their rally leader UNLESS the joiner has kvk_willing_to_move = true. Willing-to-move members can be assigned across alliance lines if it meaningfully improves rally strength. Always note in reasoning when a cross-alliance joiner assignment is made.

JOINER OPTIMIZATION:
- Best attack joiner stack: Chenko (101) + Amane (102) — different effect_ops multiply
- Best defensive joiner stack: Saul (112) + Gordon (113) + Howard or Quinn (111) — all different ops multiply
- Enemy damage reduction: Eric (202) + Fahd (201) multiply together
- Vivian as joiner: unique effect_op 200, amplifies ALL ally damage — very powerful
- NEVER recommend both Howard AND Quinn — identical effect_op 111, wastes a slot
- Fewer fuller rallies beat many thin rallies — don't split joiner pool too thin

TROOP TIER & TRUEGOLD (TG) SYSTEM:
- Troops exist as standard tiers T1-T10. T10 is the competitive baseline; in strong kingdoms nearly everyone has promoted most troops to T10, so T1-T9 are largely irrelevant for planning.
- Truegold (TG) level is a multiplicative stat bonus applied to ALL troops of that type. A player at TG5 has significantly stronger troops than TG0 regardless of tier. TG is NOT a separate troop tier — it is a global multiplier (TG0-TG10) per troop type.
- TG3+ unlocks a special combat skill (Infantry: 25% chance 36% damage reduction; Cavalry: 10% chance double damage; Archer: 20% chance 50% extra damage).
- Prioritize high-TG joiners over raw troop count when assigning joiner roles. A player with 500k T10 Infantry at TG5 outperforms one with 1M T8 Infantry at TG0.
- "effective troop strength" already folds in tier power AND the TG multiplier — rank joiners by it, not by raw troop_count.
- Ensure joiner troop types match the rally leader's formation where possible (+15% effectiveness). Mismatched troop types reduce joiner effectiveness by 10%; mixed-troop joiners are neutral.

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
      scores,
      available_from: a.available_from_utc,
      available_to: a.available_to_utc,
      squad_preference: a.squad_preference,
    }
  })

  return { members, event, weights }
}

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

  return `You are a battle planning assistant for the mobile strategy game Kingshot.
${planModeBlock}${castleBattleBlock}

EVENT: ${eventType.name}
DESCRIPTION: ${eventType.description}
OBJECTIVES: ${JSON.stringify(objectives)}
KEY RULES: ${JSON.stringify(rules.key_rules || [])}
EVENT RULES: ${JSON.stringify(rules)}

ATTENDING MEMBERS (${members.length} total):
${members.map(m => {
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

  return `
- Player: ${m.player_name}
  ID: ${m.member_id}${m.alliance_name ? `\n  Alliance: [${m.alliance_tag || ''}] ${m.alliance_name}` : ''}${m.kvk_willing_to_move !== undefined ? `\n  KVK Willing To Move: ${m.kvk_willing_to_move ? 'YES (may join a different alliance\'s rally)' : 'no (same-alliance rallies only)'}` : ''}
  Power: ${m.power.toLocaleString()}
  March Size: ${m.march_size.toLocaleString()}
  Rally Capacity: ${m.rally_capacity.toLocaleString()}
  Troop Count: ${m.troop_count.toLocaleString()} | Effective Strength: ${m.effective_troop_strength.toLocaleString()}
  Primary Troop Type: ${m.troop_type}${troopBreakdown ? `\n  Troop Breakdown:\n${troopBreakdown}` : ''}
  Hero Score: ${m.hero_score.toFixed(1)}
  Role Scores: Rally Leader=${m.scores.rallyLeader.toFixed(2)}, Joiner=${m.scores.joiner.toFixed(2)}, Castle=${m.scores.castle.toFixed(2)}, Turret=${m.scores.turret.toFixed(2)}, Support=${m.scores.support.toFixed(2)}
  Available: ${m.available_from || 'all event'} to ${m.available_to || 'all event'}
  Squad Preference: ${m.squad_preference || 'none'}`
}).join('')}

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
}

async function storeAssignments(eventId: string, plan: BattlePlan, event: any) {
  const supabase = createServiceClient()

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
 * Load the given (attending) members, scored with the KVK Castle weights, folding
 * in each member's availability window from the supplied map.
 */
async function loadKvkMembersForScoring(memberIds: string[], eventType: any, availabilityMap: Record<string, any>) {
  const supabase = createServiceClient()
  const weights = eventType.scoring_weights as Record<string, Record<string, number>>

  const { data: rawMembers } = await supabase
    .from('members')
    .select(`
      *,
      alliances ( name, tag ),
      member_combat_stats (*),
      member_heroes ( *, heroes (*) ),
      member_scores (*)
    `)
    .in('id', memberIds)

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
    const effectiveStrength = troopData ? calculateEffectiveTroopStrength(troopData) : (m.troop_count || 0)
    const a = availabilityMap[m.id]

    return {
      member_id: m.id,
      player_name: m.player_name,
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
async function storeKvkAssignments(
  plan: BattlePlan,
  eventIdByMember: Record<string, string>,
  eventName: string,
  eventStartByMember: Record<string, string | null>,
) {
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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: BATTLE_PLANNER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const plan: BattlePlan = JSON.parse(extractJSON(text))

  // Plan A is strict same-alliance: defensively strip any transfer flags the model emitted.
  if (planMode === 'A') {
    plan.transfer_recommendations = []
    for (const a of plan.assignments) {
      a.kvk_transfer = false
      delete a.transfer_alliance
      delete a.transfer_rally_leader
    }
  }

  await storeKvkAssignments(plan, eventIdByMember, pseudoEvent.name, eventStartByMember)
  return { plan, eventIds: activeEventIds }
}

async function planOneLegion(legion: 'legion1' | 'legion2', members: any[], event: any): Promise<BattlePlan | null> {
  if (members.length === 0) return null
  const label = legion === 'legion1' ? 'Legion 1' : 'Legion 2'
  const prompt = buildPlanningPrompt(members, event) +
    `\n\nIMPORTANT: This plan is for ${label} ONLY. These ${members.length} members all fight together in ${label}. Set "squad": "${legion}" on every assignment.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: BATTLE_PLANNER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const plan: BattlePlan = JSON.parse(extractJSON(text))
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

  await storeAssignments(eventId, merged, event)
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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: BATTLE_PLANNER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const plan: BattlePlan = JSON.parse(extractJSON(text))

  await storeAssignments(eventId, plan, event)
  return plan
}

