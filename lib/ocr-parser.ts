// Kingshot stat-screenshot OCR parser.
//
// Google Cloud Vision returns one big block of `fullTextAnnotation.text`. OCR
// output is noisy: spacing is inconsistent, labels and values sometimes land on
// different lines, and digits/percent signs get mangled. The goal here is to be
// FORGIVING on input but STRICT on output — only return a field when we can
// extract it with reasonable confidence, and always hand back a clean numeric
// value (commas/`+`/`%` stripped) so callers never re-parse strings.
//
// BATTLE REPORTS ARE DUAL-COLUMN. A Kingshot battle report shows two players'
// combat stats side by side, laid out per row as:
//
//     +624.3%   Infantry Attack   +673.6%
//     └ left ┘   └─ label ──┘     └ right ┘
//
// The uploading member may be on either side, so we parse BOTH columns and let
// the UI ask which one is theirs. Single-column screens (e.g. a Research stats
// screen) only have a value after the label — those collapse to one column.

export type ColumnStats = Record<string, number>

export interface ParseResult {
  // Single-value profile fields (never dual-column).
  resource: Record<string, number>
  // Combat percentages by column. For a single-column screenshot, `left` holds
  // the found values and `right` is empty (dualColumn === false).
  left: ColumnStats
  right: ColumnStats
  // True when a side-by-side battle report was detected (both columns present).
  dualColumn: boolean
  // Per-field confidence in [0,1]; lets the UI flag values worth double-checking.
  confidence: Record<string, number>
  raw: string
}

/** "131,195,663" / "131 195 663" / "131.195.663" → 131195663. Returns null if nothing usable. */
function cleanInteger(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

/** "+245.50%" / "245,50 %" / "624.3" → 245.5 / 624.3. Returns null if nothing usable. */
function cleanPercent(s: string): number | null {
  // Strip the + and % decorations, normalise a comma decimal separator to a dot.
  const cleaned = s.replace(/[+%\s]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// A large number with optional thousands separators (commas/spaces/dots) — used
// for power/troop/march/rally. Requires at least 3 digits so we don't latch onto
// stray UI numbers like a level badge.
const BIG_NUMBER = '(\\d{1,3}(?:[,.\\s]\\d{3})+|\\d{3,})'
// A bare percentage number with optional decimals (the surrounding +/% are
// matched separately so spacing variants are tolerated): "624.3", "245,50".
const PCT = '(\\d{1,4}(?:[.,]\\d{1,2})?)'

// Integer (resource) stats. Each entry lists the canonical key, the confidence
// we assign on a hit, and the label aliases that may precede the number.
const INTEGER_PATTERNS: Array<{ key: string; conf: number; labels: string[] }> = [
  { key: 'power', conf: 0.9, labels: ['power', 'pwr'] },
  { key: 'troop_count', conf: 0.85, labels: ['total troops', 'troop count', 'troops'] },
  { key: 'march_size', conf: 0.85, labels: ['march size', 'march capacity', 'march'] },
  { key: 'rally_capacity', conf: 0.85, labels: ['rally capacity', 'rally size', 'rally'] },
]

const TROOP_TYPES = ['infantry', 'cavalry', 'archer'] as const
// Attack/Defense/Health/Lethality, with spelling variants Vision tends to emit.
const COMBAT_STATS: Array<{ stat: string; aliases: string }> = [
  { stat: 'attack', aliases: 'attack|atk' },
  { stat: 'defense', aliases: 'defense|defence|def' },
  { stat: 'health', aliases: 'health|hp' },
  { stat: 'lethality', aliases: 'lethality|leth' },
]

function findInteger(text: string, labels: string[]): number | null {
  for (const label of labels) {
    // Allow up to ~15 noise chars (colons, newlines, icons) between label and value.
    const re = new RegExp(`${label}\\b[^0-9]{0,15}${BIG_NUMBER}`, 'i')
    const m = text.match(re)
    if (m) {
      const v = cleanInteger(m[1])
      if (v !== null) return v
    }
  }
  return null
}

/**
 * Look for a combat stat both as a dual-column row ("<left>% Label <right>%")
 * and as a single trailing value ("Label <value>%"). The dual pattern is kept
 * deliberately tight — the leading value must sit on the SAME line right before
 * the troop label — so a previous row's value on the line above doesn't get
 * mistaken for a left-column reading on single-column screens.
 */
function findCombat(
  text: string,
  troop: string,
  aliases: string
): { left?: number; right?: number } | null {
  // Dual: "+624.3% Infantry Attack +673.6%" (same line, value-label-value).
  const dual = new RegExp(
    `\\+?\\s*${PCT}\\s*%[ \\t]{1,5}${troop}[^0-9%\\n]{0,25}(?:${aliases})[ \\t]{0,8}\\+?\\s*${PCT}\\s*%`,
    'i'
  )
  const d = text.match(dual)
  if (d) {
    const left = cleanPercent(d[1])
    const right = cleanPercent(d[2])
    if (left !== null && right !== null) return { left, right }
  }

  // Single: "Infantry Attack 245.50%" (value after the label; newlines allowed).
  const single = new RegExp(
    `${troop}[^0-9%]{0,25}(?:${aliases})[^0-9%]{0,10}\\+?\\s*${PCT}\\s*%`,
    'i'
  )
  const s = text.match(single)
  if (s) {
    const v = cleanPercent(s[1])
    if (v !== null) return { right: v } // "single" value lives on the right of the label
  }

  return null
}

/**
 * Parse a Vision OCR text blob for Kingshot stats. Returns only the fields it
 * could extract — missing fields are simply absent, never zero-filled, so the
 * caller can distinguish "found and zero" from "not found".
 */
export function parseKingshotStats(text: string): ParseResult {
  const resource: Record<string, number> = {}
  const left: ColumnStats = {}
  const right: ColumnStats = {}
  const singles: ColumnStats = {}
  const confidence: Record<string, number> = {}

  const empty: ParseResult = { resource, left, right, dualColumn: false, confidence, raw: text || '' }
  if (!text || !text.trim()) return empty

  // Resource / profile integers (single-value).
  for (const { key, conf, labels } of INTEGER_PATTERNS) {
    const v = findInteger(text, labels)
    if (v !== null) {
      resource[key] = v
      confidence[key] = conf
    }
  }

  // Troop-type combat percentages (12 fields), tracking both columns.
  let sawDual = false
  for (const troop of TROOP_TYPES) {
    for (const { stat, aliases } of COMBAT_STATS) {
      const hit = findCombat(text, troop, aliases)
      if (!hit) continue
      const key = `${troop}_${stat}`
      confidence[key] = 0.8
      if (hit.left !== undefined && hit.right !== undefined) {
        // Dual-column row.
        sawDual = true
        left[key] = hit.left
        right[key] = hit.right
      } else if (hit.right !== undefined) {
        // Single trailing value — keep aside until we know the layout.
        singles[key] = hit.right
      }
    }
  }

  if (sawDual) {
    // Battle report: fold any single-only stats into the right column as a
    // best-effort fallback (explicit right-column readings still win).
    for (const [k, v] of Object.entries(singles)) {
      if (!(k in right)) right[k] = v
    }
    return { resource, left, right, dualColumn: true, confidence, raw: text }
  }

  // Single-column screenshot: surface the found values as the `left` column.
  return { resource, left: singles, right: {}, dualColumn: false, confidence, raw: text }
}
