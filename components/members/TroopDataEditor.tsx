// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sword, ChevronDown, ChevronRight, Check } from 'lucide-react'

// Standard tiers only — Truegold is a global multiplier, NOT a tier.
const STANDARD_TIERS = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10'] as const
// Shown most-important first (T10 leads; the rest are collapsible).
const LOWER_TIERS = ['t9','t8','t7','t6','t5','t4','t3','t2','t1'] as const
const TROOP_TYPES = ['infantry', 'cavalry', 'archer'] as const
const MAX_TG = 10

type TroopTier = (typeof STANDARD_TIERS)[number]
type TroopType = (typeof TROOP_TYPES)[number]
type TypeData = Record<TroopTier, number> & { tg_level: number }
export type TroopData = Record<TroopType, TypeData>

const TYPE_LABELS: Record<TroopType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  archer: 'Archers',
}

// TG3 special skill unlocked per troop type.
const TG3_SKILL: Record<TroopType, string> = {
  infantry: 'Unyielding Shield',
  cavalry: 'Assault Lance',
  archer: 'Howling Wind',
}

const SIMPLIFIED_KEY = 'ksc_troop_simplified'

function emptyType(): TypeData {
  const base: any = { tg_level: 0 }
  for (const t of STANDARD_TIERS) base[t] = 0
  return base
}

function emptyTroopData(): TroopData {
  return { infantry: emptyType(), cavalry: emptyType(), archer: emptyType() }
}

/** Read existing troop_data into the new structure, tolerating legacy keys. */
function mergeExisting(existing: any): TroopData {
  const data = emptyTroopData()
  if (!existing || typeof existing !== 'object') return data
  for (const type of TROOP_TYPES) {
    const src = existing[type]
    if (!src || typeof src !== 'object') continue
    for (const tier of STANDARD_TIERS) {
      // Accept both new (t10) and legacy (T10) keys.
      const v = Number(src[tier] ?? src[tier.toUpperCase()])
      if (!isNaN(v) && v > 0) data[type][tier] = v
    }
    const tg = Number(src.tg_level)
    if (!isNaN(tg) && tg > 0) data[type].tg_level = Math.max(0, Math.min(MAX_TG, tg))
  }
  return data
}

function typeTotal(data: TroopData, type: TroopType): number {
  return STANDARD_TIERS.reduce((s, t) => s + (data[type][t] || 0), 0)
}

function grandTotal(data: TroopData): number {
  return TROOP_TYPES.reduce((s, t) => s + typeTotal(data, t), 0)
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

interface Props {
  accessToken: string
  existing?: any
  onSaved?: () => void
}

export function TroopDataEditor({ accessToken, existing, onSaved }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TroopData>(() => mergeExisting(existing))
  const [simplified, setSimplified] = useState(true)
  // Per-type "show lower tiers" expansion (only relevant in full mode).
  const [expanded, setExpanded] = useState<Record<TroopType, boolean>>({
    infantry: false, cavalry: false, archer: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Load the simplified-mode preference (default ON for new members).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIMPLIFIED_KEY)
      if (stored !== null) setSimplified(stored === '1')
    } catch {}
  }, [])

  function toggleSimplified() {
    setSimplified(prev => {
      const next = !prev
      try { localStorage.setItem(SIMPLIFIED_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  function setCount(type: TroopType, tier: TroopTier, raw: string) {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? 0 : parseInt(digits, 10)
    setData(d => ({ ...d, [type]: { ...d[type], [tier]: isNaN(n) ? 0 : n } }))
  }

  function setTgLevel(type: TroopType, level: number) {
    setData(d => ({ ...d, [type]: { ...d[type], tg_level: level } }))
  }

  function inputValue(type: TroopType, tier: TroopTier): string {
    const v = data[type][tier] || 0
    return v === 0 ? '' : String(v)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/member/stats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, troop_data: data }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Save failed')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSaved?.()
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  const total = grandTotal(data)

  function NumberInput({ type, tier, prominent }: { type: TroopType; tier: TroopTier; prominent?: boolean }) {
    return (
      <input
        type="text"
        inputMode="numeric"
        value={inputValue(type, tier)}
        onChange={e => setCount(type, tier, e.target.value)}
        placeholder="—"
        className={`w-full ${prominent ? 'h-11 text-base' : 'h-9 text-sm'} px-2 text-center bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-200 placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
    )
  }

  function TroopSection({ type }: { type: TroopType }) {
    const tg = data[type].tg_level || 0
    const showLower = expanded[type]
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
        <p className="font-semibold text-slate-100">{TYPE_LABELS[type]}</p>

        {/* Truegold level — prominent at the top of each section */}
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-amber-300">Truegold Level</label>
            <select
              value={tg}
              onChange={e => setTgLevel(type, parseInt(e.target.value, 10))}
              className="h-9 px-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value={0}>None (0)</option>
              {Array.from({ length: MAX_TG }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>TG{n}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500">Your TG level applies to ALL your troops of this type</p>
          {tg >= 3 && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <Check size={13} /> {TG3_SKILL[type]} unlocked
            </p>
          )}
        </div>

        {/* Troop counts by tier */}
        <div className="space-y-2">
          {/* T10 first and most prominent */}
          <div className="flex items-center gap-2">
            <label className="w-10 text-sm font-semibold text-amber-400 shrink-0">T10</label>
            <div className="flex-1"><NumberInput type={type} tier="t10" prominent /></div>
          </div>

          {!simplified && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(s => ({ ...s, [type]: !s[type] }))}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
              >
                {showLower ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {showLower ? 'Hide lower tiers' : 'Show lower tiers (T1–T9)'}
              </button>
              {showLower && (
                <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 pt-1">
                  {LOWER_TIERS.map(tier => (
                    <div key={tier} className="flex flex-col gap-0.5">
                      <label className="text-[10px] text-slate-500 text-center uppercase">{tier}</label>
                      <NumberInput type={type} tier={tier} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Type total */}
        <div className="flex justify-between text-sm border-t border-slate-800 pt-2 text-slate-400">
          <span>Total {TYPE_LABELS[type]}:</span>
          <span className="font-semibold text-slate-200">{fmt(typeTotal(data, type))}</span>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sword size={18} className="text-amber-500" />
          Troop Breakdown
          {total > 0 && (
            <span className="ml-auto text-base font-normal text-slate-400">
              Grand total: <span className="text-amber-400 font-bold">{fmt(total)}</span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simplified mode toggle */}
        <div className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-200">Simplified Mode</p>
            <p className="text-[11px] text-slate-500">Just T10 count &amp; TG level — covers most competitive players</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={simplified}
            onClick={toggleSimplified}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              simplified ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              simplified ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Three troop sections */}
        {TROOP_TYPES.map(type => <TroopSection key={type} type={type} />)}

        {/* Grand total all troops */}
        <div className="flex justify-between text-sm border-t border-slate-700 pt-3">
          <span className="font-medium text-slate-300">Grand Total All Troops:</span>
          <span className="font-bold text-amber-400">{fmt(total)}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Save Troop Data'}
        </Button>
      </CardContent>
    </Card>
  )
}
