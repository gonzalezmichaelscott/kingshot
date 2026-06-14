// @ts-nocheck
/**
 * Swordland Showdown battle planner — TEAM-BASED, not rally-based.
 *
 * Swordland is a building-CAPTURE event. The single worst strategy is stacking
 * everyone onto one rally leader: teams must DISPERSE to seize multiple buildings
 * simultaneously for the massive first-control bonuses. This planner therefore
 * splits a legion into Attacker / Support / Defender teams (the "1/3 each" split),
 * NOT rally leaders + joiners.
 *
 * Phase 1 — assignSwordlandRoles(): pure, deterministic team assignment by power.
 * Phase 2 — generateTeamInstructionTemplates(): one AI call per team type producing
 *           plain-English phase-by-phase instructions (no per-member placeholders —
 *           every member of a team shares the team instructions).
 */
import Anthropic from '@anthropic-ai/sdk'
import { resolveTroopType } from '@/lib/hero-troop-types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type SwordlandTeam = 'attacker' | 'support' | 'defender_a' | 'defender_b' | 'substitute'

export const SWORDLAND_TEAM_LABELS: Record<SwordlandTeam, string> = {
  attacker: 'Attacker',
  support: 'Support',
  defender_a: 'Defender Team A',
  defender_b: 'Defender Team B',
  substitute: 'Substitute',
}

// Per-team building targets / focus (shown in the roster and fed to the AI).
export const SWORDLAND_BUILDING_TARGETS: Record<SwordlandTeam, string | null> = {
  attacker: 'Enemy players + contested buildings — capture and move on, never garrison',
  support: 'Fill garrison gaps, collect Baggage Trains, gather Undercellars, reinforce',
  defender_a: 'Bell Tower + Sanctum 1 + Abbey 1 + Abbey 2',
  defender_b: 'Royal Stables + Sanctum 2 + Abbey 3 + Abbey 4',
  substitute: null,
}

const NO_HERO_DATA_TEXT =
  'No hero data on file. Put your 3 strongest orange/purple combat heroes in Squad 1, next 3 in Squad 2, remaining in Squad 3. One hero per troop type per squad. Avoid Diana and Blue heroes.'

// Heroes that never belong in a combat squad regardless of stats.
const EXCLUDED_HERO_NAMES = new Set(['Seth', 'Olive', 'Edwin', 'Forrest', 'Diana'])

// Defensive duo: paired together they can cut incoming damage by up to ~40%.
const TANK_COMBO = ['Howard', 'Quinn']

export interface SwordlandMemberInput {
  id: string
  player_name: string
  power: number
  /** member_heroes rows joined with heroes(name, generation, rarity, troop_type, is_economy_hero) */
  heroes?: any[]
}

export interface SwordlandAssignment {
  member_id: string
  player_name: string
  power: number
  legion: number
  team: SwordlandTeam
  power_rank: number | null
  building_targets: string | null
  hero_squad_1: string | null
  hero_squad_2: string | null
  hero_squad_3: string | null
  hero_recommendation: string | null
  stage_instructions: string | null
}

/**
 * Rank combat heroes and split them into three squads of 3.
 *
 * MARCH RULE: a squad may contain at most ONE hero of each troop type, so every
 * squad is built as 1 infantry + 1 cavalry + 1 archer. Heroes are ranked by
 * generation then star level WITHIN their troop type; Squad 1 gets the best of
 * each type, Squad 2 the next, Squad 3 the rest. `tankFlag` adds the Howard+Quinn
 * note for defensive roles when the member owns both.
 */
function buildHeroSquads(heroRows: any[] | undefined, tankFlag = false) {
  const combat = (heroRows || []).filter((row) => {
    const h = row?.heroes || row?.hero
    if (!h?.name) return false
    if (h.is_economy_hero) return false
    if (EXCLUDED_HERO_NAMES.has(h.name)) return false
    if (h.rarity === 'common' || h.rarity === 'rare') return false
    return true
  })

  const names = new Set(combat.map((row) => (row.heroes || row.hero).name))
  const hasTankCombo = tankFlag && TANK_COMBO.every((n) => names.has(n))
  const tankNote = hasTankCombo
    ? ' You own Howard + Quinn — pair them as your defensive lead for up to ~40% incoming damage reduction.'
    : ''

  if (combat.length === 0) {
    return { squad1: null, squad2: null, squad3: null, recommendation: NO_HERO_DATA_TEXT + tankNote }
  }

  combat.sort((a, b) => {
    const ha = a.heroes || a.hero, hb = b.heroes || b.hero
    const gen = (hb.generation || 0) - (ha.generation || 0)
    if (gen !== 0) return gen
    return (b.star_level || 0) - (a.star_level || 0)
  })

  const pools: Record<string, string[]> = { infantry: [], cavalry: [], archer: [], flex: [] }
  for (const row of combat) {
    const h = row.heroes || row.hero
    const type = resolveTroopType(h)
    if (type === 'infantry' || type === 'cavalry' || type === 'archer') pools[type].push(h.name)
    else pools.flex.push(h.name)
  }

  const squads: string[][] = []
  const missingByType: Record<string, number> = {}
  for (let i = 0; i < 3; i++) {
    const squad: string[] = []
    for (const type of ['infantry', 'cavalry', 'archer']) {
      const pick = pools[type].shift() || pools.flex.shift()
      if (pick) squad.push(pick)
      else missingByType[type] = (missingByType[type] || 0) + 1
    }
    squads.push(squad)
  }

  const filledSquads = squads.filter((s) => s.length > 0).length
  const gaps = Object.entries(missingByType)
    .map(([type, count]) => ({ type, count: count - (3 - filledSquads) }))
    .filter((g) => g.count > 0)
    .map((g) => `missing ${g.count} ${g.type} hero${g.count > 1 ? 'es' : ''}`)
  const recommendation =
    (gaps.length > 0
      ? `March rule: max 1 hero of each troop type per squad (1 infantry + 1 cavalry + 1 archer). Your roster is ${gaps.join(', ')} — fill those squad slots with your best available hero of that type.`
      : '') + tankNote || null

  const join = (list: string[]) => (list.length ? list.join(' + ') : null)

  return {
    squad1: join(squads[0]),
    squad2: join(squads[1]),
    squad3: join(squads[2]),
    recommendation: recommendation || null,
  }
}

/**
 * Phase 1 — deterministic team assignment for ONE legion.
 *
 * Sort by power desc. Top 30 are combatants, the rest are substitutes. Split the
 * combatants roughly 1/3 each:
 *   - ATTACKER: the strongest players AFTER the whale (ranks 2..attacker_count+1)
 *   - SUPPORT:  the single strongest player ("whale", rank 1) + the next support_count
 *   - DEFENDER: everyone remaining, split into Team A (first half) and Team B
 *
 * The whale anchors Support per the verified strategy. Defender teams get fixed
 * building targets; Attackers/Support roam.
 */
export function assignSwordlandRoles(
  attendingMembers: SwordlandMemberInput[],
  legionNumber: number
): SwordlandAssignment[] {
  const sorted = [...attendingMembers].sort((a, b) => (b.power || 0) - (a.power || 0))
  const combatants = sorted.slice(0, 30)
  const substitutes = sorted.slice(30)
  const C = combatants.length

  const attackerCount = Math.floor(C / 3)
  const supportCount = Math.floor(C / 3)

  const whale = combatants[0] ? [combatants[0]] : []
  const attackers = combatants.slice(1, 1 + attackerCount)
  const supportRest = combatants.slice(1 + attackerCount, 1 + attackerCount + supportCount)
  const defenders = combatants.slice(1 + attackerCount + supportCount)
  const support = [...whale, ...supportRest]

  const half = Math.ceil(defenders.length / 2)
  const defenderA = defenders.slice(0, half)
  const defenderB = defenders.slice(half)

  const rankOf = (m: SwordlandMemberInput) => sorted.findIndex((s) => s.id === m.id) + 1

  const make = (m: SwordlandMemberInput, team: SwordlandTeam): SwordlandAssignment => {
    const squads = buildHeroSquads(m.heroes, team === 'defender_a' || team === 'defender_b')
    return {
      member_id: m.id,
      player_name: m.player_name,
      power: m.power || 0,
      legion: legionNumber,
      team,
      power_rank: rankOf(m),
      building_targets: SWORDLAND_BUILDING_TARGETS[team],
      hero_squad_1: squads.squad1,
      hero_squad_2: squads.squad2,
      hero_squad_3: squads.squad3,
      hero_recommendation: squads.recommendation,
      stage_instructions: null, // filled by applyTeamInstructions()
    }
  }

  const out: SwordlandAssignment[] = []
  for (const m of attackers) out.push(make(m, 'attacker'))
  for (const m of support) out.push(make(m, 'support'))
  for (const m of defenderA) out.push(make(m, 'defender_a'))
  for (const m of defenderB) out.push(make(m, 'defender_b'))
  for (const m of substitutes) out.push(make(m, 'substitute'))
  return out
}

// ── Phase 2 — AI instruction templates ──────────────────────────────────────

const SWORDLAND_KNOWLEDGE = `You are writing battle instructions for Kingshot's Swordland Showdown event. Apply these VERIFIED, COMPLETE mechanics:

EVENT TYPE: Building capture and point accumulation — NOT a rally-fill event. DURATION: 60 minutes.
CRITICAL: Teams must DISPERSE to capture multiple buildings simultaneously. Stacking everyone on one rally leader is the WORST possible strategy in Phases 1-2. Legions battle at COMPLETELY SEPARATE times — never reference the other legion.

SCORING (4 income streams):
1. FIRST CONTROL BONUS (one-time, massive): first alliance to fully occupy a building after its capture timer earns a large Alliance + Personal Relic Point bonus. Swordshrine first capture alone = 9,000 Alliance + 4,500 Personal. Claiming first-control on ALL Phase 1 buildings ≈ 26,400 Relic Points in the opening minutes. THIS is why teams DISPERSE at the start.
2. ONGOING OCCUPATION (per minute, compounds): Swordshrine 1,800/900 per min | Sanctum (x2) 1,200/600 each | Abbey (x4) 600/300 each | Buff buildings (Bell Tower, Royal Stables, Hall of Reformation, Mercenary Camp) 240/120 each. 50% of accumulated alliance points are "banked" visibly above the building; if the building is LOST those banked points drop as Baggage Trains, collectible by either side.
3. BAGGAGE TRAINS (active income): dropped as loot crates when an attacker captures a building from the enemy. Any player can march to collect them. Count toward BOTH Alliance and Personal points. Farm them the MOMENT a building changes hands.
4. DEFEATING ENEMY TROOPS (Personal points only): attacker 80 Personal per 10,000 enemy soldier power defeated; defender 40 per 10,000. High-power players reach personal cap quickly through combat.
5. UNDERCELLARS: gathering nodes spawning around the Swordshrine (first wave 15 min, second 20 min). March to gather. Both Alliance and Personal points at a slower rate. Often ignored by enemies — safe points for support/F2P.

STRUCTURES: Swordshrine (center, highest, LOCKED until 15 min) | Sanctum x2 (available Phase 1) | Abbey x4 (Phase 1). Buff buildings: Bell Tower (HIGHEST Phase 1 priority — halves capture time for every building), Royal Stables (cuts free Advanced Teleporter cooldown 12→6 min), Hall of Reformation (unlocks 15 min — +15% Squad Damage AND -15% Damage Taken), Mercenary Camp (unlocks 15 min — lowest priority, use as pre-attack softener).

PHASES:
- PHASE 1 Opening Scramble (0:00-15:00): available = Sanctums x2, Abbeys x4, Bell Tower, Royal Stables. Priority order: 1) Royal Stables first (halves alliance teleport cooldown), 2) Bell Tower second (halves capture time), 3) both Sanctums, 4) all 4 Abbeys, 5) city harassment by strongest players to force enemy retreats.
- PHASE 2 Midgame (15:00-20:00): Swordshrine, Hall of Reformation, Mercenary Camp unlock; Undercellars first wave at 15:00. Priorities: 1) Hall of Reformation immediately, 2) Swordshrine if holdable (not mandatory — pivot to Sanctums+Bell Tower+Reformation+Abbeys if too contested; tunneling everything into Swordshrine while losing Sanctums/Abbeys LOSES), 3) Mercenary Camp as a pre-attack softener.
- PHASE 3 Late Game (20:00-End): Undercellars second wave at 20:00 — send support/excess marches to gather (often unchallenged). Last 5-10 min: if behind, flip buildings with large banked reserves to drop big Baggage Train clusters; concentrated aggression pays most in the final minutes.

ROLES:
- ATTACKER: capture buildings, burn enemy cities to force retreats, disrupt garrisons. Teleport onto contested/weak buildings, rally to capture, then MOVE ON once a defender arrives. GOLDEN RULE: Attackers CAPTURE AND MOVE ON — never sit in a garrison. City harassment is a primary Phase 1 job.
- TANK/DEFENDER: hold key buildings, send reinforcements, lead defensive rallies. Garrison the main march in a Sanctum/Swordshrine; send weaker secondary marches to reinforce. Coordinate with the other defender team to cover nearby positions. Defense-oriented heroes with latest-gen widgets; Howard+Quinn cut incoming damage up to ~40%.
- SUPPORT: fill garrison slots to prevent enemy solos, collect Baggage Trains the moment buildings change hands, gather Undercellars, reinforce with weaker marches. The whale (strongest player) anchors this team. Good role for F2P/mid-tier — can even launch from the safe zone.

HEALING/ENERGY: EXIT-TO-HEAL — leaving the battlefield instantly heals ALL troops for FREE (12-min respawn cooldown). NEVER spend healing speedups inside when you can exit-to-heal. No Help button in Swordland. Free Advanced Teleporter recharges every 12 min (6 with Royal Stables) — never hoard. Activate all buffs, pet skills, and best gear before the battle.

REWARDS: Alliance bracket = Legion 1 win/loss. Personal tier = individual Personal Relic Point ranking. Top personal tier of a LOSING bracket beats the bottom tiers of a WINNING bracket — always prioritize personal score. If winning easily, trade buildings to farm Baggage Trains. If outmatched, switch to personal farming (guerrilla hits on isolated enemies, welcome defensive fights, exit/re-enter cycle). NEVER sit passively in the safe zone.`

const SWORDLAND_CRITICAL_RULES = `SWORDLAND CRITICAL RULES (must obey in every instruction):
1. NEVER tell players to join someone's rally or "fill a rally" in Phases 1-2 — Swordland requires teams to DISPERSE to capture multiple buildings. Stacking on one rally costs the match.
2. The ONLY time coordinated rallies are appropriate is the Phase 3 Swordshrine assault.
3. Attacker role: capture buildings and MOVE ON — never sit in a garrison.
4. Legion 1 and Legion 2 battle at COMPLETELY SEPARATE times in independent matches — never mention the other legion.
5. Always tell players to actively collect Baggage Trains when buildings change hands.
6. Remind players about exit-to-heal (free, 12-min cooldown) instead of burning healing speedups.`

const TEAM_BRIEFS: Record<SwordlandTeam, string> = {
  attacker: `TEAM: ATTACKER — the strongest players (minus the whale). Their job is to capture buildings fast for first-control bonuses, burn enemy cities to force retreats, and reduce enemy troop counts for personal points. They CAPTURE AND MOVE ON — they never garrison. In Phase 1 they help seize Royal Stables/Bell Tower then pressure enemy cities; in Phase 3 they lead the Swordshrine rallies.`,
  support: `TEAM: SUPPORT — anchored by the alliance's single strongest player (the "whale"). They fill garrison slots to deny enemy solos, collect Baggage Trains the instant buildings change hands, gather Undercellars (waves at 15 and 20 min), and reinforce wherever needed. When the Attack team retreats to heal, Support covers the pressure.`,
  defender_a: `TEAM: DEFENDER TEAM A — holds and defends a fixed set of buildings: ${SWORDLAND_BUILDING_TARGETS.defender_a}. They capture these in Phase 1, garrison them, and send secondary marches to reinforce. Coordinate with Defender Team B to cover the map.`,
  defender_b: `TEAM: DEFENDER TEAM B — holds and defends a fixed set of buildings: ${SWORDLAND_BUILDING_TARGETS.defender_b}. They capture these in Phase 1, garrison them, and send secondary marches to reinforce. Coordinate with Defender Team A to cover the map.`,
  substitute: `TEAM: SUBSTITUTE — outside the active roster but on standby. Keep troops healed, energy/teleporters full, and watch chat to be called up instantly if a combatant fails to show. If called up, take over the absent member's team and building targets.`,
}

/**
 * One AI call for one team type. Returns plain-text phase-by-phase instructions.
 * Every member of the team shares this text (no per-member placeholders).
 */
export async function generateTeamInstructionTemplate(team: SwordlandTeam, legionNumber: number): Promise<string> {
  const prompt = `${TEAM_BRIEFS[team]}

This is for Legion ${legionNumber}.

${SWORDLAND_CRITICAL_RULES}

Write the battle instructions for this team as plain text with EXACTLY these three section headers, in this order:

[Phase 1 — Opening Scramble (0:00-15:00)]
[Phase 2 — Midgame (15:00-20:00)]
[Phase 3 — Late Game (20:00-End)]

3-5 sentences under each header. No greeting, no closing, no markdown bullets — just the three headers and their paragraphs.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1400,
    system: SWORDLAND_KNOWLEDGE,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response?.content?.[0]?.type === 'text' ? response.content[0].text : ''
  if (!text.trim()) throw new Error(`AI returned empty instructions for team ${team}`)
  return text.trim()
}

/** Generate templates for every team present (one AI call per team type). */
export async function generateTeamInstructionTemplates(
  teams: SwordlandTeam[],
  legionNumber: number
): Promise<Record<string, string>> {
  const unique = [...new Set(teams)]
  const results = await Promise.all(unique.map((t) => generateTeamInstructionTemplate(t, legionNumber)))
  const map: Record<string, string> = {}
  unique.forEach((t, i) => { map[t] = results[i] })
  return map
}
