// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateRoleScores, calculateHeroScore, calculateEffectiveTroopStrength, TIER_MULTIPLIERS } from '@/lib/scoring'
import type { MemberHeroData, MemberProfile, TroopData } from '@/lib/scoring'
import { generateMemberInstructions } from '@/lib/member-instructions'
import { findOrCreateKingdomKvkEvent } from '@/lib/kvk'

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
- Infantry counters Archers: 25-50% bonus damage
- Archers counter Cavalry: 25-50% bonus damage
- Cavalry counters Infantry: 25-50% bonus damage

OPTIMAL FORMATIONS:
- Standard PvP attack rally: 50% Infantry / 20% Cavalry / 30% Archer
- Amadeus Bear Hunt: 5% Infantry / 25% Cavalry / 70% Archer (min 5,000 infantry to activate his skills)
- KvK Castle garrison defense: 60% Infantry / 20% Cavalry / 20% Archer

RALLY LEADER SELECTION RULES:
- Must have march_size >= rally_capacity to fill the rally
- Offensive widget = highest priority (Amadeus is the ONLY offensive infantry widget in the game)
- Gen 1-2 attack: Amadeus (offensive widget), Marlin (archer)
- Gen 3+ attack: Petra (multiplicative whole-rally ATK buff — non-negotiable), Rosa, Long Fei, Vivian, Yang, Ava
- Zoe NEVER leads attack rallies — her kit is purely defensive
- Garrison/defense: Zoe, Jabel, Eric, Alcar, Charles (Gen 7)

JOINER OPTIMIZATION:
- Best attack joiner stack: Chenko (101) + Amane (102) — different effect_ops multiply
- Best defensive joiner stack: Saul (112) + Gordon (113) + Howard or Quinn (111) — all different ops multiply
- Enemy damage reduction: Eric (202) + Fahd (201) multiply together
- Vivian as joiner: unique effect_op 200, amplifies ALL ally damage — very powerful
- NEVER recommend both Howard AND Quinn — identical effect_op 111, wastes a slot
- Fewer fuller rallies beat many thin rallies — don't split joiner pool too thin

TROOP TIER SYSTEM:
- Standard tiers T1-T10: T1-T4 are negligible (0.1x), T5-T6 moderate (0.3x), T7-T8 decent (0.6x), T9 strong (0.85x), T10 baseline (1.0x)
- True Gold tiers TG1-TG8 are substantially stronger: TG1=1.3x, TG2=1.5x, TG3=1.8x, TG4=2.1x, TG5=2.5x, TG6=3.0x, TG7=3.6x, TG8=4.2x
- A joiner with 300k TG5 troops (effective: 750k) outperforms one with 2M T7 troops (effective: 1.2M)
- Lower tier troops die off faster under enemy fire, reducing the joiner's contribution mid-rally
- When assigning rally joiners, prioritize members with higher effective troop strength (TG1+ > T10 > T9 etc)
- Ensure joiner troop types match the rally leader's formation where possible (+15% effectiveness)
- Mismatched troop types reduce joiner effectiveness by 10%; mixed-troop joiners are neutral

Return a JSON battle plan with: summary, formations, assignments (each with member_id, player_name, role, squad, formation_recommendation, hero_recommendation, reasoning, is_primary, is_backup, time_window), joiner_stacking_advice, coverage_gaps, backup_plan, warnings.
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
}

export interface BattlePlan {
  assignments: BattlePlanAssignment[]
  summary: string
  formations?: Record<string, string>
  joiner_stacking_advice?: string
  coverage_gaps: string[]
  backup_plan?: string
  warnings?: string[]
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

function buildPlanningPrompt(members: any[], event: any): string {
  const eventType = event.event_types
  const rules = eventType.rules
  const objectives = eventType.objectives

  return `You are a battle planning assistant for the mobile strategy game Kingshot.

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
        if (!typeData) return null
        const tiers = Object.entries(typeData)
          .filter(([, v]) => (v as number) > 0)
          .map(([tier, v]) => `${tier}=${(v as number).toLocaleString()}`)
        if (!tiers.length) return null
        const eff = tiers.length
          ? Object.entries(typeData)
              .reduce((s, [tier, v]) => s + (v as number) * (TIER_MULTIPLIERS[tier] ?? 0.1), 0)
          : 0
        return `    ${type}: ${tiers.join(', ')} (eff: ${Math.round(eff).toLocaleString()})`
      }).filter(Boolean).join('\n')
    : null

  return `
- Player: ${m.player_name}
  ID: ${m.member_id}
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
6. For KVK Castle Battle: assign castle team, 4 turret teams (N/E/S/W), support roles, and rotation schedule
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
 * Load every member across the participating alliances, scored with the KVK
 * Castle weights. Availability windows are folded in when an anchor event exists;
 * members without an availability row are treated as available for the whole event.
 */
async function loadKingdomMembersWithScores(allianceIds: string[], eventType: any, eventId?: string) {
  const supabase = createServiceClient()
  const weights = eventType.scoring_weights as Record<string, Record<string, number>>

  const { data: rawMembers } = await supabase
    .from('members')
    .select(`
      *,
      member_combat_stats (*),
      member_heroes ( *, heroes (*) ),
      member_scores (*)
    `)
    .in('alliance_id', allianceIds)

  const availabilityMap: Record<string, any> = {}
  if (eventId) {
    const { data: avail } = await supabase
      .from('event_availability')
      .select('*')
      .eq('event_id', eventId)
    for (const a of avail || []) availabilityMap[a.member_id] = a
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
    const effectiveStrength = troopData ? calculateEffectiveTroopStrength(troopData) : (m.troop_count || 0)
    const a = availabilityMap[m.id]

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
      available_from: a?.available_from_utc || null,
      available_to: a?.available_to_utc || null,
      squad_preference: a?.squad_preference || null,
    }
  })
}

/**
 * Generate a kingdom-wide KVK Castle battle plan combining ALL members from ALL
 * participating alliances, and store the assignments against the kingdom's anchor
 * KVK event. Returns the plan and the anchor event id.
 */
export async function generateKingdomKvkBattlePlan(kingdomId: string): Promise<{ plan: BattlePlan; eventId: string }> {
  const { event, allianceIds, eventType } = await findOrCreateKingdomKvkEvent(kingdomId, true)

  if (!eventType) throw new Error('KVK Castle Battle event type is not configured. Run the schema seed data.')
  if (allianceIds.length === 0) throw new Error('No alliances have KVK enabled for this kingdom.')
  if (!event) throw new Error('Could not create the kingdom KVK event.')

  const members = await loadKingdomMembersWithScores(allianceIds, eventType, event.id)
  if (members.length === 0) throw new Error('No members found across the participating alliances.')

  const prompt = buildPlanningPrompt(members, event)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: BATTLE_PLANNER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const plan: BattlePlan = JSON.parse(extractJSON(text))

  await storeAssignments(event.id, plan, event)
  return { plan, eventId: event.id }
}

export async function generateBattlePlan(eventId: string): Promise<BattlePlan> {
  const { members, event } = await loadAttendingMembersWithScores(eventId)

  if (members.length === 0) {
    throw new Error('No attending members found for this event')
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

