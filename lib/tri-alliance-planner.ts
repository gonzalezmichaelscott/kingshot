// @ts-nocheck
/**
 * Tri-Alliance Clash battle planner.
 *
 * Phase 1 — assignTriAllianceRoles(): pure, deterministic role assignment by power.
 * Phase 2 — generateRoleInstructionTemplates(): one AI call per role type producing
 *           plain-English stage-by-stage instruction templates with placeholders,
 *           then applyInstructionTemplate() fills them in per member.
 */
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type TriRole = 'main_player' | 'supporter' | 'special_force' | 'reaction_team' | 'commander' | 'substitute'

export const TRI_ROLE_LABELS: Record<TriRole, string> = {
  main_player: 'Main Player',
  supporter: 'Supporter',
  special_force: 'Special Commander Force',
  reaction_team: 'Reaction Team',
  commander: 'Commander',
  substitute: 'Substitute',
}

// Step 6 — formation per role. Temple Hold is a Stage 4 instruction, not a role.
export const TRI_FORMATIONS: Record<TriRole, string> = {
  main_player: '40% Infantry / 20% Cavalry / 40% Archers',
  supporter: '60% Infantry / 10% Cavalry / 30% Archers',
  special_force: '40% Infantry / 20% Cavalry / 40% Archers',
  reaction_team: '60% Infantry / 10% Cavalry / 30% Archers',
  commander: 'No formation needed — buff management role only',
  substitute: '60% Infantry / 10% Cavalry / 30% Archers',
}
export const TEMPLE_HOLD_FORMATION = '65% Infantry / 10% Cavalry / 25% Archers'

const NO_HERO_DATA_TEXT =
  'No hero data on file. Put your 3 strongest orange/purple combat heroes in Squad 1, next 3 in Squad 2, remaining in Squad 3. Avoid Diana and Blue heroes.'

// Heroes that never belong in a combat squad regardless of stats.
const EXCLUDED_HERO_NAMES = new Set(['Seth', 'Olive', 'Edwin', 'Forrest', 'Diana'])

export interface TriMemberInput {
  id: string
  player_name: string
  power: number
  /** member_heroes rows joined with heroes(name, generation, rarity, is_economy_hero) */
  heroes?: any[]
}

export interface TriAssignment {
  member_id: string
  player_name: string
  power: number
  legion: number
  role: TriRole
  power_rank: number | null
  assigned_to: string | null
  assigned_to_name: string | null
  reaction_team_letter: 'A' | 'B' | null
  formation: string
  hero_squad_1: string | null
  hero_squad_2: string | null
  hero_squad_3: string | null
  hero_recommendation: string | null
}

/** Step 7 — rank combat heroes and split them into three squads of 3. */
function buildHeroSquads(heroRows: any[] | undefined) {
  const combat = (heroRows || []).filter((row) => {
    const h = row?.heroes || row?.hero
    if (!h?.name) return false
    if (h.is_economy_hero) return false
    if (EXCLUDED_HERO_NAMES.has(h.name)) return false
    // Blue-tier (rare) and below are excluded even at high star level.
    if (h.rarity === 'common' || h.rarity === 'rare') return false
    return true
  })

  if (combat.length === 0) {
    return { squad1: null, squad2: null, squad3: null, recommendation: NO_HERO_DATA_TEXT }
  }

  // Generation first (Gen 6 > Gen 5 > ...), then star level.
  combat.sort((a, b) => {
    const ha = a.heroes || a.hero, hb = b.heroes || b.hero
    const gen = (hb.generation || 0) - (ha.generation || 0)
    if (gen !== 0) return gen
    return (b.star_level || 0) - (a.star_level || 0)
  })

  const names = combat.map((row) => (row.heroes || row.hero).name)
  const join = (list: string[]) => (list.length ? list.join(' + ') : null)
  return {
    squad1: join(names.slice(0, 3)),
    squad2: join(names.slice(3, 6)),
    squad3: join(names.slice(6, 9)),
    recommendation: null,
  }
}

/**
 * Phase 1 — deterministic role assignment for one legion.
 *
 * Sorts by power desc, caps combatants at 30 (rest are substitutes), pulls the
 * leader-designated Commanders out, then deals roles to the remaining combatants
 * in power order: 6 Main Players, 12 Supporters, 6 Special Force, 4 Reaction Team.
 * Supporters are paired two-per-Main-Player; Reaction Team splits into A and B.
 */
export function assignTriAllianceRoles(
  attendingMembers: TriMemberInput[],
  commanderIds: string[],
  legionNumber: number
): TriAssignment[] {
  const commanders = new Set((commanderIds || []).slice(0, 2))
  const sorted = [...attendingMembers].sort((a, b) => (b.power || 0) - (a.power || 0))

  // Step 1 — cap at 30 combatants.
  let combatants = sorted.slice(0, 30)
  let substitutes = sorted.slice(30)

  // A designated Commander outside the top 30 is promoted into the combatant
  // list (the lowest-power non-commander combatant drops to substitute).
  for (const sub of [...substitutes]) {
    if (!commanders.has(sub.id)) continue
    for (let i = combatants.length - 1; i >= 0; i--) {
      if (!commanders.has(combatants[i].id)) {
        substitutes = substitutes.filter(m => m.id !== sub.id)
        substitutes.push(combatants[i])
        combatants[i] = sub
        break
      }
    }
  }
  substitutes.sort((a, b) => (b.power || 0) - (a.power || 0))

  // Step 2 — extract Commanders from the combatant list.
  const commanderMembers = combatants.filter(m => commanders.has(m.id))
  const remaining = combatants.filter(m => !commanders.has(m.id))

  const out: TriAssignment[] = []
  const base = (m: TriMemberInput, role: TriRole, rank: number | null): TriAssignment => {
    const squads = buildHeroSquads(m.heroes)
    return {
      member_id: m.id,
      player_name: m.player_name,
      power: m.power || 0,
      legion: legionNumber,
      role,
      power_rank: rank,
      assigned_to: null,
      assigned_to_name: null,
      reaction_team_letter: null,
      formation: TRI_FORMATIONS[role],
      hero_squad_1: squads.squad1,
      hero_squad_2: squads.squad2,
      hero_squad_3: squads.squad3,
      hero_recommendation: squads.recommendation,
    }
  }

  for (const c of commanderMembers) out.push(base(c, 'commander', null))

  // Step 3 — deal roles to the remaining combatants by power rank (1-based).
  const mains = remaining.slice(0, 6)
  const supporters = remaining.slice(6, 18)
  const specialForce = remaining.slice(18, 24)
  const reaction = remaining.slice(24, 28)
  // Anyone past 28 remaining combatants (possible when fewer than 2 commanders
  // were designated) overflows to substitute.
  const overflow = remaining.slice(28)

  const mainAssignments = mains.map((m, i) => base(m, 'main_player', i + 1))
  out.push(...mainAssignments)

  // Step 4 — pair Supporters to Main Players: ranks 7-8 → MP1, 9-10 → MP2, ...
  supporters.forEach((m, i) => {
    const a = base(m, 'supporter', i + 7)
    const mp = mains[Math.floor(i / 2)]
    if (mp) {
      a.assigned_to = mp.id
      a.assigned_to_name = mp.player_name
    }
    out.push(a)
  })

  specialForce.forEach((m, i) => out.push(base(m, 'special_force', i + 19)))

  // Step 5 — Reaction Team A: ranks 25-26, Team B: ranks 27-28.
  reaction.forEach((m, i) => {
    const a = base(m, 'reaction_team', i + 25)
    a.reaction_team_letter = i < 2 ? 'A' : 'B'
    out.push(a)
  })

  for (const m of [...overflow, ...substitutes]) out.push(base(m, 'substitute', null))

  return out
}

// ── Phase 2 — AI instruction templates ──────────────────────────────────────

const TRI_ALLIANCE_KNOWLEDGE = `You are writing battle instructions for Kingshot's Tri-Alliance Clash event. Here are the verified mechanics:

EVENT: 60-minute battle, 3 alliances compete for buildings. Points come from HOLDING buildings, not kills. The Sea God Temple gives 50,000 bonus points if holding it when the timer expires — this single building usually decides the match.

BUILDING VALUES: Sea God Temple +1800/min + 50k end bonus | Garrison +1800/min (unlocks at 20 min) | Ruin Cluster +600/min | Transit Center +60/min but CRITICAL for Temple access | Buildings A29/B29/C29 = only march routes to Temple, must defend

4 STAGES:
- Stage 1 (0-3 min): Preparation — no movement, receive targets from leader
- Stage 2 (3-20 min): Seize & Conquer — capture buildings on your side, secure Transit Centers, Garrisons are shielded
- Stage 3 (20-40 min): Garrison Occupation — Garrisons unlock, defend yours, attack enemy's with coordinated rallies NEVER solo
- Stage 4 (40-60 min): Temple Onslaught — Temple unlocks at 40 min, ALL IN, first capture = 50k bonus

ENERGY: Powers all movement. Captains (R4/R5 designated) regenerate faster. Save 30-40% for Stage 4. Heal at a secured building NOT at HQ (HQ respawn = 2-minute walk). Use Conscript button to heal between battles.

SKIP RULE: 5 squads needed to bypass a building without capturing — key mechanic for Special Force

DIPLOMACY: 3-way match — if one alliance is dominating, the other two may informally coordinate against them. Account for betrayal in Stage 4.

IMPORTANT: Bonus Items, King's Perks, Ministry positions, Alliance territory bonuses, and Outpost bonuses have ZERO effect inside Tri-Alliance Clash.

Write instructions for each role covering all 4 stages. Be direct and specific. 3-5 sentences per stage maximum.`

const ROLE_BRIEFS: Record<TriRole, string> = {
  main_player: `Role: MAIN PLAYER — one of the legion's 6 strongest players. Formation: ${TRI_FORMATIONS.main_player}. They lead building captures, anchor Garrison defenses, and lead rallies in Stages 3-4. Two dedicated Supporters reinforce them all match. In Stage 4 they spearhead the Temple push; when holding the Temple they should switch to ${TEMPLE_HOLD_FORMATION}.`,
  supporter: `Role: SUPPORTER — paired with a specific Main Player for the whole battle (refer to that player using the exact placeholder {MAIN_PLAYER} — do not invent a name). Formation: ${TRI_FORMATIONS.supporter}. Their job is to reinforce {MAIN_PLAYER}'s captures, garrison what {MAIN_PLAYER} takes, and join {MAIN_PLAYER}'s rallies in Stages 3-4. When holding the Temple they should switch to ${TEMPLE_HOLD_FORMATION}.`,
  special_force: `Role: SPECIAL COMMANDER FORCE — a 6-player squad. Formation: ${TRI_FORMATIONS.special_force}. They use the 5-squad SKIP rule to bypass buildings without capturing, secure Transit Centers early, and control the A29/B29/C29 march routes to the Temple. In Stage 4 they open and hold the Temple route. When holding the Temple they should switch to ${TEMPLE_HOLD_FORMATION}.`,
  reaction_team: `Role: REACTION TEAM — a 2-player rapid-response pair (refer to their team using the exact placeholder {TEAM_LETTER} — A or B, do not pick one). Formation: ${TRI_FORMATIONS.reaction_team}. They stay mobile, retake any building that flips, and plug holes in the line. In Stage 4 they screen the Temple approaches against counterattacks.`,
  commander: `Role: COMMANDER — buff management only, no fixed formation (${TRI_FORMATIONS.commander}). The legion's most active players. They watch the map, call targets in chat/voice, time the Stage 3 Garrison rallies, manage energy captain duties, and decide when to commit everything to the Temple in Stage 4.`,
  substitute: `Role: SUBSTITUTE — outside the 30 combatant slots but on standby. They keep troops healed, energy full, and watch chat so they can be called up instantly if a combatant fails to show. Write instructions for staying ready during each stage and what to do if called up mid-battle.`,
}

/**
 * One AI call for one role type. Returns a plain-text stage-by-stage instruction
 * template. Supporter templates contain {MAIN_PLAYER}; reaction team templates
 * contain {TEAM_LETTER}.
 */
export async function generateRoleInstructionTemplate(role: TriRole, legionNumber: number): Promise<string> {
  const prompt = `${ROLE_BRIEFS[role]}

This is for Legion ${legionNumber}.

Write the battle instructions for this role as plain text with EXACTLY these four section headers, in this order:

[Stage 1 — Preparation (0:00-3:00)]
[Stage 2 — Seize & Conquer (3:00-20:00)]
[Stage 3 — Garrison Occupation (20:00-40:00)]
[Stage 4 — Temple Onslaught (40:00-60:00)]

3-5 sentences under each header. No greeting, no closing, no markdown bullets — just the four headers and their paragraphs.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1200,
    system: TRI_ALLIANCE_KNOWLEDGE,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response?.content?.[0]?.type === 'text' ? response.content[0].text : ''
  if (!text.trim()) throw new Error(`AI returned empty instructions for role ${role}`)
  return text.trim()
}

/** Generate templates for every role present in the plan (one AI call per role type). */
export async function generateRoleInstructionTemplates(
  roles: TriRole[],
  legionNumber: number
): Promise<Record<string, string>> {
  const unique = [...new Set(roles)]
  const results = await Promise.all(unique.map(r => generateRoleInstructionTemplate(r, legionNumber)))
  const map: Record<string, string> = {}
  unique.forEach((r, i) => { map[r] = results[i] })
  return map
}

/** Fill a role template's placeholders for one member. */
export function applyInstructionTemplate(template: string, assignment: TriAssignment): string {
  return template
    .replaceAll('{MAIN_PLAYER}', assignment.assigned_to_name || 'your assigned Main Player')
    .replaceAll('{TEAM_LETTER}', assignment.reaction_team_letter || 'A')
}
