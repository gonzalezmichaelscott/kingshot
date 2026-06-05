// @ts-nocheck
'use client'
// Reusable "📷 Scan Screenshot" control. Uploads a stat screenshot to the OCR
// endpoint, then shows the extracted values as a checklist so the member chooses
// exactly which ones to apply — OCR is never trusted to write silently.
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

interface Props {
  // Only these keys are surfaced for review (lets the Stats tab show
  // power/march/rally while the Combat section shows troop stats).
  allowedKeys: string[]
  // Receives the subset the member checked + confirmed. Should persist them.
  onApply: (selected: Record<string, number>) => void | Promise<void>
  helpText?: string
}

type State = 'idle' | 'uploading' | 'review' | 'error'

export function ScanScreenshotButton({ allowedKeys, onApply, helpText }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [found, setFound] = useState<Record<string, number>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

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

      // Keep only the fields this instance cares about.
      const relevant: Record<string, number> = {}
      for (const [k, v] of Object.entries(data.fields || {})) {
        if (allowedKeys.includes(k) && typeof v === 'number') relevant[k] = v
      }

      if (Object.keys(relevant).length === 0) {
        setState('error')
        setErrorMsg('Could not read screenshot. Please enter stats manually.')
        return
      }

      setFound(relevant)
      setChecked(Object.fromEntries(Object.keys(relevant).map(k => [k, true])))
      setState('review')
    } catch {
      setState('error')
      setErrorMsg('Could not read screenshot. Please enter stats manually.')
    }
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
      setFound({})
      setChecked({})
    } finally {
      setApplying(false)
    }
  }

  function cancel() {
    setState('idle')
    setFound({})
    setChecked({})
    setErrorMsg('')
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

      {state !== 'review' && (
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
