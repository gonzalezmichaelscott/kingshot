// @ts-nocheck
'use client'
// Reusable "📷 Scan Screenshot" control. Uploads a stat screenshot to the OCR
// endpoint, then walks the member through:
//   1. (battle reports only) a LEFT/RIGHT column selector — Kingshot battle
//      reports show two players side by side and the member must say which is
//      theirs; a preview of each side helps them pick.
//   2. a checkbox review so they choose exactly which values to apply.
// Single-column screenshots (e.g. a Research stats screen) skip step 1.
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

// Display metadata for every field the parser can return. `percent: true` means
// the value is a combat-stat percentage (show "+X.XX%"); otherwise it's a large
// integer (show with thousands separators).
const FIELD_META: Record<string, { label: string; percent?: boolean }> = {
  power: { label: 'Power' },
  troop_count: { label: 'Troop Count' },
  march_size: { label: 'March Size' },
  rally_capacity: { label: 'Rally Capacity' },
  infantry_attack: { label: 'Infantry Attack', percent: true },
  infantry_defense: { label: 'Infantry Defense', percent: true },
  infantry_health: { label: 'Infantry Health', percent: true },
  infantry_lethality: { label: 'Infantry Lethality', percent: true },
  cavalry_attack: { label: 'Cavalry Attack', percent: true },
  cavalry_defense: { label: 'Cavalry Defense', percent: true },
  cavalry_health: { label: 'Cavalry Health', percent: true },
  cavalry_lethality: { label: 'Cavalry Lethality', percent: true },
  archer_attack: { label: 'Archer Attack', percent: true },
  archer_defense: { label: 'Archer Defense', percent: true },
  archer_health: { label: 'Archer Health', percent: true },
  archer_lethality: { label: 'Archer Lethality', percent: true },
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

function formatValue(key: string, value: number): string {
  if (FIELD_META[key]?.percent) return `+${Number(value).toFixed(2)}%`
  return Number(value).toLocaleString('en-US')
}

/** Abbreviated label for the compact column preview, e.g. "Infantry ATK". */
function shortLabel(key: string): string {
  return (FIELD_META[key]?.label || key)
    .replace('Attack', 'ATK')
    .replace('Defense', 'DEF')
    .replace('Health', 'HP')
    .replace('Lethality', 'LETH')
}

/** One-line "Infantry ATK +624.30% | Cavalry ATK +661.80% | …" preview for a column. */
function previewLine(col: Record<string, number>): string {
  const preferred = ['infantry_attack', 'cavalry_attack', 'archer_attack']
  let keys = preferred.filter(k => k in col)
  if (keys.length === 0) keys = Object.keys(col).slice(0, 3)
  return keys.map(k => `${shortLabel(k)} ${formatValue(k, col[k])}`).join('  |  ')
}

/** Keep only the entries whose key is allowed and whose value is a number. */
function pick(obj: Record<string, any>, allowed: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (allowed.includes(k) && typeof v === 'number') out[k] = v
  }
  return out
}

interface Props {
  // Only these keys are surfaced for review (lets the Stats tab show
  // power/march/rally while the Combat section shows troop stats).
  allowedKeys: string[]
  // Receives the subset the member checked + confirmed. Should persist them.
  onApply: (selected: Record<string, number>) => void | Promise<void>
  helpText?: string
}

type State = 'idle' | 'uploading' | 'selectColumn' | 'review' | 'error'

export function ScanScreenshotButton({ allowedKeys, onApply, helpText }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  // Pending columns held while the member picks their side (dual-column reports).
  const [resourceFound, setResourceFound] = useState<Record<string, number>>({})
  const [leftFound, setLeftFound] = useState<Record<string, number>>({})
  const [rightFound, setRightFound] = useState<Record<string, number>>({})
  // The final flat set under review.
  const [found, setFound] = useState<Record<string, number>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

  function reset() {
    setResourceFound({})
    setLeftFound({})
    setRightFound({})
    setFound({})
    setChecked({})
  }

  function beginReview(values: Record<string, number>) {
    if (Object.keys(values).length === 0) {
      setState('error')
      setErrorMsg('Could not read screenshot. Please enter stats manually.')
      return
    }
    setFound(values)
    setChecked(Object.fromEntries(Object.keys(values).map(k => [k, true])))
    setState('review')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-uploading the same file
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      setState('error')
      setErrorMsg('Please upload a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setState('error')
      setErrorMsg('Image must be under 10MB.')
      return
    }

    setState('uploading')
    setErrorMsg('')
    reset()
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr/battle-stats', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.manual_entry_required) {
        setState('error')
        setErrorMsg('Could not read screenshot. Please enter stats manually.')
        return
      }

      // Filter every part of the response down to the keys this instance wants.
      const resource = pick(data.resource || {}, allowedKeys)
      const left = pick(data.left || {}, allowedKeys)
      const right = pick(data.right || {}, allowedKeys)
      const dual = !!data.dualColumn && Object.keys(left).length > 0 && Object.keys(right).length > 0

      if (Object.keys(resource).length + Object.keys(left).length + Object.keys(right).length === 0) {
        setState('error')
        setErrorMsg('Could not read screenshot. Please enter stats manually.')
        return
      }

      if (dual) {
        // Side-by-side battle report — ask which column is theirs first.
        setResourceFound(resource)
        setLeftFound(left)
        setRightFound(right)
        setState('selectColumn')
      } else {
        // Single column — go straight to review. Combat values land in `left`
        // for single-column screens; fall back to `right` just in case.
        const combat = Object.keys(left).length ? left : right
        beginReview({ ...resource, ...combat })
      }
    } catch {
      setState('error')
      setErrorMsg('Could not read screenshot. Please enter stats manually.')
    }
  }

  function chooseColumn(side: 'left' | 'right') {
    const combat = side === 'left' ? leftFound : rightFound
    beginReview({ ...resourceFound, ...combat })
  }

  async function apply() {
    const selected: Record<string, number> = {}
    for (const [k, v] of Object.entries(found)) {
      if (checked[k]) selected[k] = v
    }
    setApplying(true)
    try {
      await onApply(selected)
      setState('idle')
      reset()
    } finally {
      setApplying(false)
    }
  }

  function cancel() {
    setState('idle')
    setErrorMsg('')
    reset()
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      {(state === 'idle' || state === 'uploading' || state === 'error') && (
        <>
          {state === 'uploading' ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-3">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Reading your screenshot…
            </div>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              📷 Scan Screenshot
            </Button>
          )}

          {state === 'error' && errorMsg && (
            <p className="text-sm text-amber-400">{errorMsg}</p>
          )}

          {helpText && (
            <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">{helpText}</p>
          )}
        </>
      )}

      {/* Step 1 — column selector (battle reports only) */}
      {state === 'selectColumn' && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Which column shows YOUR stats?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Battle reports show both players side by side — pick the side with your numbers.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['left', 'right'] as const).map(side => {
              const col = side === 'left' ? leftFound : rightFound
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => chooseColumn(side)}
                  className="text-left rounded-lg border border-slate-600 hover:border-amber-500 hover:bg-slate-800 transition-colors p-3"
                >
                  <span className="block text-sm font-semibold text-amber-400 mb-1">
                    {side === 'left' ? 'Left Column' : 'Right Column'}
                  </span>
                  <span className="block text-xs text-slate-300 leading-relaxed">
                    {previewLine(col)}
                  </span>
                </button>
              )
            })}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}

      {/* Step 2 — checkbox review */}
      {state === 'review' && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-3">
          <p className="text-sm text-slate-300">
            We found these stats in your screenshot. Select which ones to apply:
          </p>
          <div className="space-y-1.5">
            {Object.entries(found).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-amber-500 w-4 h-4"
                  checked={!!checked[key]}
                  onChange={() => setChecked(c => ({ ...c, [key]: !c[key] }))}
                />
                <span className="text-slate-400">{FIELD_META[key]?.label || key}:</span>
                <span className="font-medium text-slate-100">{formatValue(key, value)}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={apply}
              disabled={applying || !Object.values(checked).some(Boolean)}
            >
              {applying ? 'Applying…' : 'Apply Selected Stats'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={applying}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
