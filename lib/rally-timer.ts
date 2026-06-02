// Shared rally-timer math used by both the leader (RallyTimerSession) and the
// read-only viewer (SharedTimerView) so the launch sequence, staggered landing
// plan, and wave labels are computed identically on every device.

export type LandingMode = 'simultaneous' | 'staggered'

export interface RTPlayer {
  id: string
  name: string
  marchTime: number // seconds
  [k: string]: any
}

export interface ComputedPlayer extends RTPlayer {
  sortedIndex: number
  launchOffset: number  // seconds after timer start (0:00) when this player launches
  arrivalOffset: number // seconds after timer start when this player's troops land
}

// Selectable gaps (seconds) for staggered landing.
export const LANDING_GAPS = [1, 2, 3, 5, 10, 15, 30]

export function sortByMarch<T extends RTPlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => b.marchTime - a.marchTime)
}

/**
 * Compute each player's launch + arrival offset (seconds from timer start).
 *
 * Simultaneous: everyone ARRIVES together. The longest-march player (BASE)
 *   launches first at 0:00; the rest launch later so all troops land at once.
 *
 * Staggered: troops land one after another `gap` seconds apart. The BASE
 *   (longest march) is the FINISHER and lands LAST; each earlier player in the
 *   sorted order lands `gap` seconds before the next, which means earlier
 *   players launch earlier.
 */
export function computePlan(players: RTPlayer[], mode: LandingMode, gap: number): ComputedPlayer[] {
  const sorted = sortByMarch(players)
  const base = sorted[0]?.marchTime || 0

  const raw = sorted.map((p, i) => {
    if (mode === 'staggered') {
      const arrival = base - gap * i        // i = 0 (BASE) lands last at `base`
      return { p, i, launch: arrival - p.marchTime, arrival }
    }
    const launch = base - p.marchTime       // simultaneous: all arrive at `base`
    return { p, i, launch, arrival: base }
  })

  // Normalize so the earliest launch is 0:00 (the moment the timer starts).
  const minLaunch = Math.min(0, ...raw.map(r => r.launch))
  return raw.map(r => ({
    ...r.p,
    sortedIndex: r.i,
    launchOffset: r.launch - minLaunch,
    arrivalOffset: r.arrival - minLaunch,
  }))
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth']

/** Wave label for staggered mode. BASE (finisher) = "Final"; first to land = "First". */
export function waveLabel(sortedIndex: number, total: number): string {
  if (sortedIndex === 0) return 'Final'
  const fromFirst = (total - 1) - sortedIndex // 0 = first to land
  return ORDINALS[fromFirst] || `Wave ${fromFirst + 1}`
}
