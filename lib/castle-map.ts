// Shared geometry + slot ordering for the interactive Castle Positioning Map
// (FEATURE 3). Pure module with no server/client dependencies so it can be used by
// both the CastleMap client component and the server-side auto-population.
//
// GEOMETRY (full rebuild): the map is authored in a 560×560 orthogonal square and
// the whole SVG is CSS-rotated 45° to produce the in-game diamond view.
//
// In the UNDERLYING SQUARE (pre-rotation) coordinate space:
//   • The CASTLE is a diamond centred at (280,280), half-size 80 → its four pointed
//     tips land at top(280,200), right(360,280), bottom(280,360), left(200,280).
//   • The four TURRETS sit RIGHT ON those castle tips (N=top, E=right, S=bottom,
//     W=left), half-overlapping the castle edge.
//   • City slots fill the four triangular bands between the castle and the dashed
//     outer boundary — 2 rows of 6 slots per face (48 total).
// Slot contents and popups are counter-rotated −45° in the component so text stays
// upright after the parent SVG's +45° rotation.

export type Side = 'n' | 'e' | 's' | 'w'

export interface CitySlot {
  id: string        // `${FACE}_R${row}_C${col}`  e.g. "N_R1_C3"
  side: Side        // 'n' | 'e' | 's' | 'w'
  row: number       // 1 = inner (front line, nearest castle), 2 = outer (rear)
  col: number       // 1..6 across the face
  x: number         // center x in the 0..560 viewBox (pre-rotation)
  y: number         // center y
}

// ── Canvas + structure geometry (560×560 viewBox) ───────────────────────────
export const MAP_VIEWBOX = 560

// Castle diamond.
export const CASTLE_CENTER = 280
export const CASTLE_HALF = 80
/** Castle diamond tip points (top, right, bottom, left). */
export const CASTLE_POINTS = {
  top:    { x: 280, y: 200 },
  right:  { x: 360, y: 280 },
  bottom: { x: 280, y: 360 },
  left:   { x: 200, y: 280 },
}

// Outer dashed battle boundary diamond (~20px inset from SVG edges).
export const OUTER_POINTS = {
  top:    { x: 280, y: 20 },
  right:  { x: 540, y: 280 },
  bottom: { x: 280, y: 540 },
  left:   { x: 20,  y: 280 },
}

export const TURRET_SIZE = 28       // purple square side length
export const SLOT_SIZE = 44         // city-slot rounded-rect side length

// Turret centres sit exactly on the castle diamond tips.
export const TURRETS: { side: Side; x: number; y: number; label: string }[] = [
  { side: 'n', x: 280, y: 200, label: 'N' }, // top    tip
  { side: 'e', x: 360, y: 280, label: 'E' }, // right  tip
  { side: 's', x: 280, y: 360, label: 'S' }, // bottom tip
  { side: 'w', x: 200, y: 280, label: 'W' }, // left   tip
]

// ── City slots ──────────────────────────────────────────────────────────────
// Each face has an inner row (R1, close to castle) and an outer row (R2). One
// axis is fixed per row; the other varies across the 6 columns. Coordinates are
// authored explicitly to match the exact layout spec (no overlap).
export const ROWS = 2
export const COLS = 6

type FaceGeom = {
  axis: 'x' | 'y'   // which coordinate is FIXED per row
  inner: number     // fixed coord for row 1
  outer: number     // fixed coord for row 2
  vary: number[]    // the 6 varying-coordinate values (col 1..6)
}

const FACE_GEOM: Record<Side, FaceGeom> = {
  n: { axis: 'y', inner: 140, outer: 86,  vary: [80, 128, 176, 224, 272, 320] },
  e: { axis: 'x', inner: 390, outer: 450, vary: [80, 128, 176, 224, 272, 320] },
  s: { axis: 'y', inner: 420, outer: 474, vary: [240, 288, 336, 384, 432, 480] },
  w: { axis: 'x', inner: 170, outer: 110, vary: [240, 288, 336, 384, 432, 480] },
}

const SIDE_LETTER: Record<Side, string> = { n: 'N', e: 'E', s: 'S', w: 'W' }
const SIDE_ORDER: Side[] = ['n', 'e', 's', 'w']

function buildSlots(): CitySlot[] {
  const slots: CitySlot[] = []
  for (const side of SIDE_ORDER) {
    const g = FACE_GEOM[side]
    for (let row = 1; row <= ROWS; row++) {
      const fixed = row === 1 ? g.inner : g.outer
      for (let col = 1; col <= COLS; col++) {
        const v = g.vary[col - 1]
        const x = g.axis === 'y' ? v : fixed   // axis='y' → y fixed, x varies
        const y = g.axis === 'y' ? fixed : v
        slots.push({ id: `${SIDE_LETTER[side]}_R${row}_C${col}`, side, row, col, x, y })
      }
    }
  }
  return slots
}

export const CITY_SLOTS: CitySlot[] = buildSlots()

export const SLOT_BY_ID: Record<string, CitySlot> = Object.fromEntries(
  CITY_SLOTS.map(s => [s.id, s])
)

// ── Auto-populate ordering ───────────────────────────────────────────────────
// Columns fill from the centre outward so a leader (placed first) lands on the
// centred slot of its target row: col 3, then 4, 2, 5, 1, 6.
const COL_ORDER = [3, 4, 2, 5, 1, 6]

function rowQueue(side: Side, row: number): string[] {
  return COL_ORDER.map(c => `${SIDE_LETTER[side]}_R${row}_C${c}`)
}

/** Slot ids for one face, primary row first (centre-out), then the other row. */
function faceQueue(side: Side, primaryRow: 1 | 2): string[] {
  const other = primaryRow === 1 ? 2 : 1
  return [...rowQueue(side, primaryRow), ...rowQueue(side, other)]
}

// Each battle-plan structure targets a specific face + row so leaders land on the
// spec'd slots: castle R1 leader → N/S inner centre, turret leaders → their row centre.
//   castle-1     → North inner (N_R1_C3 …)
//   castle-2     → South inner (S_R1_C3 …)
//   north_turret → North outer (N_R2_C3 …)
//   east_turret  → East  inner (E_R1_C3 …)
//   south_turret → South outer (S_R2_C3 …)
//   west_turret  → West  inner (W_R1_C3 …)
const STRUCTURE_TARGET: Record<string, { side: Side; row: 1 | 2 }> = {
  'castle-1':     { side: 'n', row: 1 },
  'castle-2':     { side: 's', row: 1 },
  'north_turret': { side: 'n', row: 2 },
  'east_turret':  { side: 'e', row: 1 },
  'south_turret': { side: 's', row: 2 },
  'west_turret':  { side: 'w', row: 1 },
}

/** Ordered slot queue for a battle-plan structure key (leader-centred, then outward). */
export function slotQueueForStructure(structureKey: string): string[] {
  const t = STRUCTURE_TARGET[structureKey]
  if (!t) return [...ALL_SLOTS_NEAREST_FIRST]
  return faceQueue(t.side, t.row)
}

/** Slot ids for one face, inner row first (centre-out). Kept for back-compat. */
export function slotIdsForSide(side: Side): string[] {
  return faceQueue(side, 1)
}

/** Every slot id ordered globally nearest-first (used for overflow placement). */
export const ALL_SLOTS_NEAREST_FIRST: string[] = (() => {
  const ids: string[] = []
  for (let row = 1; row <= ROWS; row++) {
    for (const side of SIDE_ORDER) {
      for (const col of COL_ORDER) ids.push(`${SIDE_LETTER[side]}_R${row}_C${col}`)
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
