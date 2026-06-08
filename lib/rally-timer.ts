// Shared rally-timer math used by both the leader (RallyTimerSession) and the
// read-only viewer (SharedTimerView) so the launch sequence, staggered landing
// plan, landing order and wave labels are computed identically on every device.

export type LandingMode = 'simultaneous' | 'staggered'

export interface RTPlayer {
  id: string
  name: string
  marchTime: number // seconds
  [k: string]: any
}

export interface ComputedPlayer extends RTPlayer {
  orderIndex: number    // position in the landing order: 0 = Wave 1 (lands FIRST)
  wave: number          // orderIndex + 1 (human-friendly wave number)
  isFinisher: boolean    // true for the LAST wave (captures the structure)
  launchOffset: number  // seconds after timer start (0:00) when this player launches
  arrivalOffset: number // seconds after timer start when this player's troops land
}

// Selectable gaps (seconds) between landings for staggered mode.
export const LANDING_GAPS = [1, 2, 3, 5, 10, 15, 30]

/** Longest march first (descending). Used for the default auto landing order. */
export function sortByMarch<T extends RTPlayer>(players: T[]): T[] {
  return [...players].sort((a, b) => b.marchTime - a.marchTime)
}

/**
 * Default ("auto") landing order: longest march = Wave 1 (lands FIRST, weakens
 * defenses), shortest march = finisher (lands last, captures). Returns player ids.
 */
export function autoOrder(players: RTPlayer[]): string[] {
  return sortByMarch(players).map(p => p.id)
}

/**
 * Resolve the effective landing order. A persisted `customOrder` (array of player
 * ids, index 0 = Wave 1) takes priority; any players missing from it (e.g. just
 * added) are appended in auto order so they always appear. Falls back to auto.
 */
export function orderPlayers(players: RTPlayer[], customOrder?: string[] | null): RTPlayer[] {
  if (customOrder && customOrder.length) {
    const byId = new Map(players.map(p => [p.id, p]))
    const ordered: RTPlayer[] = []
    for (const id of customOrder) {
      const p = byId.get(id)
      if (p) { ordered.push(p); byId.delete(id) }
    }
    // Append any players not present in the custom order (newly added) in auto order.
    for (const p of sortByMarch(Array.from(byId.values()))) ordered.push(p)
    return ordered
  }
  return sortByMarch(players)
}

/**
 * Compute each player's launch + arrival offset (seconds from timer start).
 *
 * Simultaneous: everyone ARRIVES together. The longest-march player launches
 *   first at 0:00; the rest launch later so all troops land at once.
 *
 * Staggered: troops land one after another `gap` seconds apart, in the resolved
 *   landing order. Wave 1 (index 0) lands FIRST; the last wave is the finisher and
 *   lands last. Each player's launch = their landing time − their march time.
 *   Offsets are normalized so the earliest launch is 0:00.
 */
export function computePlan(
  players: RTPlayer[],
  mode: LandingMode,
  gap: number,
  customOrder?: string[] | null,
): ComputedPlayer[] {
  if (mode === 'staggered') {
    const ordered = orderPlayers(players, customOrder)
    const n = ordered.length
    const raw = ordered.map((p, i) => {
      const arrival = gap * i            // Wave 1 (i=0) lands first; each +gap later
      return { p, i, launch: arrival - p.marchTime, arrival }
    })
    // Normalize so the earliest launch is 0:00 (the moment the timer starts).
    const minLaunch = Math.min(0, ...raw.map(r => r.launch))
    return raw.map(r => ({
      ...r.p,
      orderIndex: r.i,
      wave: r.i + 1,
      isFinisher: r.i === n - 1,
      launchOffset: r.launch - minLaunch,
      arrivalOffset: r.arrival - minLaunch,
    }))
  }

  // Simultaneous: all arrive together at the longest march time.
  const ordered = sortByMarch(players)
  const base = ordered[0]?.marchTime || 0
  return ordered.map((p, i) => ({
    ...p,
    orderIndex: i,
    wave: i + 1,
    isFinisher: false,
    launchOffset: base - p.marchTime,
    arrivalOffset: base,
  }))
}

/** Short wave label for staggered mode, e.g. "Wave 1". Last wave = "Finisher". */
export function waveLabel(orderIndex: number, total: number): string {
  if (orderIndex === total - 1) return 'Finisher'
  return `Wave ${orderIndex + 1}`
}
