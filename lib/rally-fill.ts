// Deterministic rally-capacity filling (FIX 3 + FIX 5) with manual position
// support (FIX 2) and incomplete-data defaults (FIX 1).
//
// Given the rally leaders and joiners assigned to the castle, distribute joiners
// into per-leader rallies using real capacity math instead of a fixed count:
//   available_joiner_space = rally_capacity - march_size
// Joiners are sorted by march_size descending and added until the next one would
// exceed the remaining space.
//
// FIX 1 — when a leader has rally_capacity = 0 OR march_size = 0, the data is
// incomplete: we treat the rally as able to hold up to 15 joiners (the game cap)
// by defaulting capacity to 9,999,999, and estimate any joiner whose march_size
// is 0 at 50,000 — so a rally is filled to 15 rather than left partly empty.
//
// FIX 2 — a leader/joiner may carry an explicit rally_number (set by a manual
// override). Those are placed in that exact rally; everyone else is auto-filled
// into the remaining space.
//
// Pure function with no server dependencies, so client components can import it.

export interface RallyMember {
  id: string
  player_name: string
  game_id?: string | null
  tag?: string | null
  march_size?: number
  rally_capacity?: number
  isManual?: boolean
  kvk_transfer?: boolean
  /** Manual override: which castle rally (1-3) this player belongs to. */
  rally_number?: number | null
}

export interface CastleRally {
  index: number
  leader: RallyMember
  joiners: RallyMember[]
  capacity: number
  /** leader march + assigned joiners' march */
  used: number
  /** capacity - leader march, before joiners are added */
  availableSpace: number
  /** capacity or leader march was 0 → fell back to "up to 15 joiners" */
  incomplete: boolean
}

export const MAX_JOINERS_PER_RALLY = 15
export const MARCH_ESTIMATE = 50_000
// High default capacity so an incomplete rally fills up to MAX_JOINERS_PER_RALLY.
export const DEFAULT_CAPACITY = 9_999_999

interface WorkingRally extends CastleRally {
  _space: number
  _max: number
}

function makeRally(index: number, leader: RallyMember): WorkingRally {
  const rawCap = Number(leader.rally_capacity) || 0
  const leaderMarch = Number(leader.march_size) || 0
  const incomplete = !rawCap || !leaderMarch
  const capacity = incomplete ? DEFAULT_CAPACITY : rawCap
  const space = Math.max(0, capacity - leaderMarch)
  return {
    index,
    leader,
    joiners: [],
    capacity,
    used: leaderMarch,
    availableSpace: space,
    incomplete,
    _space: space,
    _max: incomplete ? MAX_JOINERS_PER_RALLY : Number.POSITIVE_INFINITY,
  }
}

/**
 * Build castle rallies from the castle's leaders and joiners. Manual rally_number
 * assignments are honored; the rest fill strongest-leader-first with the
 * largest-march joiners. Joiners that don't fit are appended to the last rally so
 * none are silently dropped.
 */
export function buildCastleRallies(leaders: RallyMember[], joiners: RallyMember[]): CastleRally[] {
  // 1. Assign a rally index to every leader, honoring manual rally_number first.
  const leaderByIndex: Record<number, RallyMember> = {}
  const autoLeaders: RallyMember[] = []
  for (const l of leaders) {
    const n = Number(l.rally_number) || 0
    if (n >= 1 && !leaderByIndex[n]) leaderByIndex[n] = l
    else autoLeaders.push(l)
  }
  autoLeaders.sort((a, b) => (b.rally_capacity || 0) - (a.rally_capacity || 0))
  let next = 1
  for (const l of autoLeaders) {
    while (leaderByIndex[next]) next++
    leaderByIndex[next] = l
    next++
  }

  const indices = Object.keys(leaderByIndex).map(Number).sort((a, b) => a - b)
  const rallies: WorkingRally[] = indices.map(i => makeRally(i, leaderByIndex[i]))
  const rallyByIndex: Record<number, WorkingRally> = {}
  for (const r of rallies) rallyByIndex[r.index] = r

  // 2. Manual joiners go straight to their rally.
  for (const j of joiners) {
    const n = Number(j.rally_number) || 0
    if (n < 1) continue
    const r = rallyByIndex[n] || rallies[0]
    if (!r) continue
    const jm = Number(j.march_size) || MARCH_ESTIMATE
    r.joiners.push(j)
    r.used += jm
    r._space -= jm
  }

  // 3. Auto joiners (largest march first) greedily fill rallies in index order.
  const autoJoiners = joiners
    .filter(j => !(Number(j.rally_number) >= 1))
    .sort((a, b) => (b.march_size || 0) - (a.march_size || 0))
  for (const r of rallies) {
    while (autoJoiners.length > 0 && r.joiners.length < r._max) {
      const jm = Number(autoJoiners[0].march_size) || MARCH_ESTIMATE
      if (!r.incomplete && jm > r._space) break
      const j = autoJoiners.shift()!
      r.joiners.push(j)
      r.used += jm
      r._space -= jm
    }
  }
  // Leftover joiners that didn't fit anywhere → last rally (never dropped).
  if (autoJoiners.length > 0 && rallies.length > 0) {
    rallies[rallies.length - 1].joiners.push(...autoJoiners)
  }

  return rallies.map(({ _space, _max, ...r }) => r)
}

/** Split a list of castle assignees into (non-backup) leaders and everyone else. */
export function splitCastleRoles<T extends { role?: string | null; is_backup?: boolean }>(
  assignees: T[]
): { leaders: T[]; joiners: T[] } {
  const leaders = assignees.filter(a => a.role?.toLowerCase().includes('leader') && !a.is_backup)
  const joiners = assignees.filter(a => !(a.role?.toLowerCase().includes('leader') && !a.is_backup))
  return { leaders, joiners }
}
