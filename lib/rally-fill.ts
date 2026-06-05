// Deterministic rally-capacity filling (FIX 3 + FIX 5).
//
// Given the rally leaders and joiners assigned to the castle, distribute joiners
// into per-leader rallies using real capacity math instead of a fixed count:
//   available_joiner_space = rally_capacity - march_size
// Joiners are sorted by march_size descending and added until the next one would
// exceed the remaining space. Incomplete data falls back to the game's hard cap
// of 15 joiners; a joiner with no march_size is estimated at 50,000.
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
}

export interface CastleRally {
  index: number
  leader: RallyMember
  joiners: RallyMember[]
  capacity: number
  /** leader march + assigned joiners' march */
  used: number
  /** rally_capacity - march_size, before joiners are added */
  availableSpace: number
  /** capacity or leader march was 0 → fell back to max-15 joiners */
  incomplete: boolean
}

export const MAX_JOINERS_PER_RALLY = 15
export const MARCH_ESTIMATE = 50_000

/**
 * Build castle rallies from the castle's leaders and joiners. Leaders are filled
 * strongest-first (by rally_capacity); the largest-march joiners fill first.
 * Joiners that don't fit any rally's capacity are appended to the last rally so
 * they are never silently dropped.
 */
export function buildCastleRallies(leaders: RallyMember[], joiners: RallyMember[]): CastleRally[] {
  const sortedLeaders = [...leaders].sort((a, b) => (b.rally_capacity || 0) - (a.rally_capacity || 0))
  const pool = [...joiners].sort((a, b) => (b.march_size || 0) - (a.march_size || 0))

  const rallies: CastleRally[] = []
  sortedLeaders.forEach((leader, i) => {
    const capacity = Number(leader.rally_capacity) || 0
    const leaderMarch = Number(leader.march_size) || 0
    const incomplete = !capacity || !leaderMarch
    const availableSpace = incomplete ? 0 : Math.max(0, capacity - leaderMarch)

    let space = availableSpace
    let used = incomplete ? 0 : leaderMarch
    const assigned: RallyMember[] = []
    const maxCount = incomplete ? MAX_JOINERS_PER_RALLY : Number.POSITIVE_INFINITY

    // Consume from the front (largest march). Stop this rally when the next joiner
    // would exceed remaining capacity; remaining joiners roll to the next leader.
    while (pool.length > 0 && assigned.length < maxCount) {
      const jm = Number(pool[0].march_size) || MARCH_ESTIMATE
      if (!incomplete && jm > space) break
      const j = pool.shift()!
      assigned.push(j)
      space -= jm
      used += jm
    }

    rallies.push({
      index: i + 1,
      leader,
      joiners: assigned,
      capacity,
      used,
      availableSpace,
      incomplete,
    })
  })

  // Any joiners that didn't fit go to the last rally (overflow) so none are lost.
  if (pool.length > 0 && rallies.length > 0) {
    rallies[rallies.length - 1].joiners.push(...pool)
  }

  return rallies
}

/** Split a list of castle assignees into (non-backup) leaders and everyone else. */
export function splitCastleRoles<T extends { role?: string | null; is_backup?: boolean }>(
  assignees: T[]
): { leaders: T[]; joiners: T[] } {
  const leaders = assignees.filter(a => a.role?.toLowerCase().includes('leader') && !a.is_backup)
  const joiners = assignees.filter(a => !(a.role?.toLowerCase().includes('leader') && !a.is_backup))
  return { leaders, joiners }
}
