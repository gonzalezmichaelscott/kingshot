// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateRoleScores, calculateHeroScore } from '@/lib/scoring'
import type { MemberHeroData, MemberProfile } from '@/lib/scoring'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface BattlePlanAssignment {
  member_id: string
  player_name: string
  role: string
  squad: string | null
  is_primary: boolean
  is_backup: boolean
  reasoning: string
  time_window_start?: string
  time_window_end?: string
}

export interface BattlePlan {
  assignments: BattlePlanAssignment[]
  summary: string
  coverage_gaps: string[]
  recommendations: string[]
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
      starLevel: mh.star_level,
      widgetLevel: mh.widget_level,
      expeditionSkillLevels: mh.expedition_skill_levels || {},
    }))

    const profile: MemberProfile = {
      id: m.id,
      power: m.power || 0,
      troopCount: m.troop_count || 0,
      marchSize: m.march_size || 0,
      rallyCapacity: m.rally_capacity || 0,
      primaryTroopType: (stats?.troop_type_primary || 'mixed') as any,
      heroes: heroData,
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

    return {
      member_id: m.id,
      player_name: m.player_name,
      power: m.power,
      march_size: m.march_size,
      rally_capacity: m.rally_capacity,
      troop_count: m.troop_count,
      troop_type: stats?.troop_type_primary || 'unknown',
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
${members.map(m => `
- Player: ${m.player_name}
  ID: ${m.member_id}
  Power: ${m.power.toLocaleString()}
  March Size: ${m.march_size.toLocaleString()}
  Rally Capacity: ${m.rally_capacity.toLocaleString()}
  Troop Count: ${m.troop_count.toLocaleString()}
  Primary Troop Type: ${m.troop_type}
  Hero Score: ${m.hero_score.toFixed(1)}
  Role Scores: Rally Leader=${m.scores.rallyLeader.toFixed(2)}, Joiner=${m.scores.joiner.toFixed(2)}, Castle=${m.scores.castle.toFixed(2)}, Turret=${m.scores.turret.toFixed(2)}, Support=${m.scores.support.toFixed(2)}
  Available: ${m.available_from || 'all event'} to ${m.available_to || 'all event'}
  Squad Preference: ${m.squad_preference || 'none'}
`).join('')}

INSTRUCTIONS:
1. Assign every attending member a primary role and squad (if applicable)
2. Designate backup players for critical roles (rally leaders especially)
3. Explain WHY each assignment was made — reference specific stats
4. Identify coverage gaps (time windows with insufficient players, missing backups)
5. For Swordland: fill Squad A and Squad B with 30 members each, 10 substitutes
6. For KVK Castle Battle: assign castle team, 4 turret teams (N/E/S/W), support roles, and rotation schedule
7. For Tri Alliance Clash: assign by phase (Seize, Garrison, Temple) with defenders and assault teams
8. Match march size to rally capacity — don't exceed rally capacity with joiners

Respond ONLY with valid JSON in this exact schema:
{
  "assignments": [
    {
      "member_id": "uuid",
      "player_name": "name",
      "role": "role_name",
      "squad": "A|B|castle|north_turret|east_turret|south_turret|west_turret|support|null",
      "is_primary": true,
      "is_backup": false,
      "reasoning": "Specific explanation referencing their stats",
      "time_window_start": "ISO datetime or null",
      "time_window_end": "ISO datetime or null"
    }
  ],
  "summary": "Overall plan summary",
  "coverage_gaps": ["List of identified gaps"],
  "recommendations": ["Strategic recommendations for leaders"]
}`
}

async function storeAssignments(eventId: string, plan: BattlePlan) {
  const supabase = createServiceClient()

  // Clear existing assignments
  await supabase.from('event_assignments').delete().eq('event_id', eventId)

  // Insert new assignments
  const rows = plan.assignments.map(a => ({
    event_id: eventId,
    member_id: a.member_id,
    role: a.role,
    squad: a.squad,
    is_primary: a.is_primary,
    is_backup: a.is_backup,
    reasoning: a.reasoning,
    time_window_start: a.time_window_start || null,
    time_window_end: a.time_window_end || null,
  }))

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

export async function generateBattlePlan(eventId: string): Promise<BattlePlan> {
  const { members, event } = await loadAttendingMembersWithScores(eventId)

  if (members.length === 0) {
    throw new Error('No attending members found for this event')
  }

  const prompt = buildPlanningPrompt(members, event)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are a battle planning assistant for the mobile strategy game Kingshot.
You analyze player statistics and generate optimized battle assignments.
Always explain WHY each assignment was made, referencing specific stats.
Respond only in valid JSON matching the BattlePlan schema provided.
Never include markdown code fences in your response — raw JSON only.`,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const plan: BattlePlan = JSON.parse(extractJSON(text))

  await storeAssignments(eventId, plan)
  return plan
}

