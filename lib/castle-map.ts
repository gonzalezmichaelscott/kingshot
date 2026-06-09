// Shared geometry + slot ordering for the interactive Castle Positioning Map
// (FEATURE 3). Pure module with no server/client dependencies so it can be used by
// both the CastleMap client component and the server-side auto-population.
//
// The map is authored in a normal orthogonal coordinate system (viewBox 0..100).
// The CastleMap component rotates the whole SVG 45° via CSS so it reads as the
// in-game diamond; slot contents are counter-rotated -45° to stay upright.

export type Side = 'n' | 'e' | 's' | 'w'

export interface CitySlot {
  id: string        // `${side}-${depth}-${lateral}`  e.g. "n-0-1"
  side: Side
  depth: number     // 0 = nearest the castle (front line), higher = rear/support
  lateral: number   // 0..2 across the face
  x: number         // center x in the 0..100 viewBox
  y: number         // center y
}

export const MAP_VIEWBOX = 100
export const SLOT_SIZE = 9          // square side length in viewBox units
export const CASTLE_MIN = 39
export const CASTLE_MAX = 61
export const OUTER_MIN = 4          // dashed battle-boundary diamond
export const OUTER_MAX = 96

const DEPTHS = 2
const LATERALS = 3
const LATERAL_CENTERS = [36, 50, 64]
// Depth 0 sits just outside the castle face; depth 1 is one step further out.
const DEPTH_OFFSETS = [30, 18]      // distance band centers (north/west use 100-?)

function buildSlots(): CitySlot[] {
  const slots: CitySlot[] = []
  for (let depth = 0; depth < DEPTHS; depth++) {
    const near = DEPTH_OFFSETS[depth]        // toward top/left
    const far = MAP_VIEWBOX - near           // toward bottom/right
    for (let lateral = 0; lateral < LATERALS; lateral++) {
      const lat = LATERAL_CENTERS[lateral]
      // North: above castle. East: right. South: below. West: left.
      slots.push({ id: `n-${depth}-${lateral}`, side: 'n', depth, lateral, x: lat, y: near })
      slots.push({ id: `e-${depth}-${lateral}`, side: 'e', depth, lateral, x: far, y: lat })
      slots.push({ id: `s-${depth}-${lateral}`, side: 's', depth, lateral, x: lat, y: far })
      slots.push({ id: `w-${depth}-${lateral}`, side: 'w', depth, lateral, x: near, y: lat })
    }
  }
  return slots
}

export const CITY_SLOTS: CitySlot[] = buildSlots()

export const SLOT_BY_ID: Record<string, CitySlot> = Object.fromEntries(
  CITY_SLOTS.map(s => [s.id, s])
)

// Turret centers (purple "T") at the four midpoints of the castle's sides.
export const TURRETS: { side: Side; x: number; y: number; label: string }[] = [
  { side: 'n', x: 50, y: CASTLE_MIN, label: 'N' },
  { side: 'e', x: CASTLE_MAX, y: 50, label: 'E' },
  { side: 's', x: 50, y: CASTLE_MAX, label: 'S' },
  { side: 'w', x: CASTLE_MIN, y: 50, label: 'W' },
]

// Lateral fill priority within a face: center first, then the flanks — so a rally
// leader (placed first) lands on the centered front-line slot.
const LATERAL_ORDER = [1, 0, 2]

/** Slot ids for one face, ordered nearest-the-castle first (front line → rear). */
export function slotIdsForSide(side: Side): string[] {
  const ids: string[] = []
  for (let depth = 0; depth < DEPTHS; depth++) {
    for (const lateral of LATERAL_ORDER) ids.push(`${side}-${depth}-${lateral}`)
  }
  return ids
}

const SIDE_ORDER: Side[] = ['n', 'e', 's', 'w']

/** Every slot id ordered globally nearest-first (used for overflow placement). */
export const ALL_SLOTS_NEAREST_FIRST: string[] = (() => {
  const ids: string[] = []
  for (let depth = 0; depth < DEPTHS; depth++) {
    for (const side of SIDE_ORDER) {
      for (const lateral of LATERAL_ORDER) ids.push(`${side}-${depth}-${lateral}`)
    }
  }
  return ids
})()

/** Preferred face for a structure when auto-populating from the battle plan. */
export function preferredFaceForSquad(squad: string, rallyNumber?: number | null): Side {
  switch (squad) {
    case 'castle':
      return rallyNumber === 2 ? 's' : 'n'   // Rally 1 → North face, Rally 2 → South face
    case 'north_turret': return 'n'
    case 'east_turret': return 'e'
    case 'south_turret': return 's'
    case 'west_turret': return 'w'
    default: return 'n'
  }
}
