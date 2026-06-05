// Kingshot stat-screenshot OCR parser.
//
// Google Cloud Vision returns one big block of `fullTextAnnotation.text`. OCR
// output is noisy: spacing is inconsistent, labels and values sometimes land on
// different lines, and digits/percent signs get mangled. The goal here is to be
// FORGIVING on input but STRICT on output — only return a field when we can
// extract it with reasonable confidence, and always hand back a clean numeric
// value (commas/`+`/`%` stripped) so callers never re-parse strings.

export interface ParsedStats {
  // Profile / governor screen
  power?: number
  troop_count?: number
  march_size?: number
  rally_capacity?: number
  // Battle-report combat stats (percentages, stored as plain numbers e.g. 245.5)
  infantry_attack?: number
  infantry_defense?: number
  infantry_health?: number
  infantry_lethality?: number
  cavalry_attack?: number
  cavalry_defense?: number
  cavalry_health?: number
  cavalry_lethality?: number
  archer_attack?: number
  archer_defense?: number
  archer_health?: number
  archer_lethality?: number
}

export interface ParseResult {
  fields: ParsedStats
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

/** "+245.50%" / "245,50 %" → 245.5. Returns null if nothing usable. */
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
// A percentage value with optional leading + and decimals: "+245.50%", "98%".
const PERCENT = '\\+?\\s*(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*%'

// Integer (resource) stats. Each entry lists the canonical key, the confidence
// we assign on a hit, and the label aliases that may precede the number.
const INTEGER_PATTERNS: Array<{ key: keyof ParsedStats; conf: number; labels: string[] }> = [
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

function findPercent(text: string, troop: string, aliases: string): number | null {
  // Label order in-game is "<Troop> <Stat>", but OCR can flip or pad it. Try the
  // natural order first, then a looser fallback that allows the stat label alone
  // to appear near the troop label.
  const ordered = new RegExp(`${troop}[^0-9%]{0,25}(?:${aliases})[^0-9%]{0,10}${PERCENT}`, 'i')
  const m = text.match(ordered)
  if (m) return cleanPercent(m[1])
  return null
}

/**
 * Parse a Vision OCR text blob for Kingshot stats. Returns only the fields it
 * could extract — missing fields are simply absent, never zero-filled, so the
 * caller can distinguish "found and zero" from "not found".
 */
export function parseKingshotStats(text: string): ParseResult {
  const fields: ParsedStats = {}
  const confidence: Record<string, number> = {}
  if (!text || !text.trim()) return { fields, confidence, raw: text || '' }

  // Resource / profile integers.
  for (const { key, conf, labels } of INTEGER_PATTERNS) {
    const v = findInteger(text, labels)
    if (v !== null) {
      ;(fields as any)[key] = v
      confidence[key] = conf
    }
  }

  // Troop-type combat percentages (12 fields).
  for (const troop of TROOP_TYPES) {
    for (const { stat, aliases } of COMBAT_STATS) {
      const v = findPercent(text, troop, aliases)
      if (v !== null) {
        const key = `${troop}_${stat}`
        ;(fields as any)[key] = v
        confidence[key] = 0.8
      }
    }
  }

  return { fields, confidence, raw: text }
}
