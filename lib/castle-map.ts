// Shared geometry + slot ordering for the interactive Castle Positioning Map
// (FEATURE 3). Pure module with no server/client dependencies so it can be used by
// both the CastleMap client component and the server-side auto-population.
//
// GEOMETRY (FIX 1): the map is authored in a normal orthogonal square (viewBox
// 0..100) and the whole SVG is rotated 45° via CSS, which turns it into the
// in-game diamond. Under a clockwise 45° rotation the four CORNERS of the square
// land on the four pointed TIPS of the diamond (top/right/bottom/left), so the
// turrets are placed at the corners:
//   top-left  corner → top tip    → North turret
//   top-right corner → right tip   → East turret
//   bottom-right     → bottom tip  → South turret
//   bottom-left      → left  tip   → West turret
// The four EDGES of the square become the four diagonal FACES of the diamond,
// each carrying a row of 6 city slots (2 rows deep). Slot contents are
// counter-rotated -45° in the component so text stays upright.

export type Side = 'n' | 'e' | 's' | 'w'

export interface CitySlot {
  id: string        // `${side}-${row}-${col}`  e.g. "n-0-2"
  side: Side
  depth: number     // row: 0 = nearest the castle (front line), higher = rear/outer
  lateral: number   // col: 0..5 across the face
  x: number         // center x in the 0..100 viewBox (pre-rotation)
  y: number         // center y
}

export const MAP_VIEWBOX = 100
export const SLOT_SIZE = 9          // square side length in viewBox units
export const CASTLE_MIN = 38
export const CASTLE_MAX = 62
export const OUTER_MIN = 4          // dashed battle-boundary diamond
export const OUTER_MAX = 96

// 6 columns per face, 2 rows deep (inner front line + one rear row) = 48 slots.
export const ROWS = 2
export const COLS = 6
const COL_MIN = 20
const COL_MAX = 80
const ROW_INNER = 30   // row 0 sits just outside the castle face
const ROW_STEP = 12    // each subsequent row steps outward toward the boundary

// Column fill priority: center columns first so a rally leader (placed first)
// lands on the centered front-line slot of its face.
const COL_ORDER = [2, 3, 1, 4, 0, 5]

function colCoord(col: number): number {
  return COL_MIN + (col * (COL_MAX - COL_MIN)) / (COLS - 1)
}
/** Distance of a row from the relevant edge, measured toward the castle. */
function rowInset(row: number): number {
  return ROW_INNER - row * ROW_STEP   // row0 = 30 (inner), row1 = 18 (outer)
}

function buildSlots(): CitySlot[] {
  const slots: CitySlot[] = []
  for (let row = 0; row < ROWS; row++) {
    const ri = rowInset(row)
    for (let col = 0; col < COLS; col++) {
      const cc = colCoord(col)
      // North face = LEFT edge (small x); East = TOP edge (small y);
      // South = RIGHT edge (large x); West = BOTTOM edge (large y).
      slots.push({ id: `n-${row}-${col}`, side: 'n', depth: row, lateral: col, x: ri, y: cc })
      slots.push({ id: `e-${row}-${col}`, side: 'e', depth: row, lateral: col, x: cc, y: ri })
      slots.push({ id: `s-${row}-${col}`, side: 's', depth: row, lateral: col, x: MAP_VIEWBOX - ri, y: cc })
      slots.push({ id: `w-${row}-${col}`, side: 'w', depth: row, lateral: col, x: cc, y: MAP_VIEWBOX - ri })
    }
  }
  return slots
}

export const CITY_SLOTS: CitySlot[] = buildSlots()

export const SLOT_BY_ID: Record<string, CitySlot> = Object.fromEntries(
  CITY_SLOTS.map(s => [s.id, s])
)

// Turret centers (purple "T") at the four CORNERS of the square → diamond tips.
export const TURRETS: { side: Side; x: number; y: number; label: string }[] = [
  { side: 'n', x: 8, y: 8, label: 'N' },   // top-left corner  → top tip
  { side: 'e', x: 92, y: 8, label: 'E' },  // top-right corner → right tip
  { side: 's', x: 92, y: 92, label: 'S' }, // bottom-right     → bottom tip
  { side: 'w', x: 8, y: 92, label: 'W' },  // bottom-left      → left tip
]

/** Slot ids for one face, ordered nearest-the-castle first (front line → rear). */
export function slotIdsForSide(side: Side): string[] {
  const ids: string[] = []
  for (let row = 0; row < ROWS; row++) {
    for (const col of COL_ORDER) ids.push(`${side}-${row}-${col}`)
  }
  return ids
}

const SIDE_ORDER: Side[] = ['n', 'e', 's', 'w']

/** Every slot id ordered globally nearest-first (used for overflow placement). */
export const ALL_SLOTS_NEAREST_FIRST: string[] = (() => {
  const ids: string[] = []
  for (let row = 0; row < ROWS; row++) {
    for (const side of SIDE_ORDER) {
      for (const col of COL_ORDER) ids.push(`${side}-${row}-${col}`)
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
