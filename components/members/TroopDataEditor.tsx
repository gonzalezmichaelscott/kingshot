// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sword, Check } from 'lucide-react'

// Standard tiers only — Truegold is a global multiplier, NOT a tier.
const STANDARD_TIERS = ['t1','t2','t3','t4','t5','t6','t7','t8','t9','t10'] as const
// Tiers shown below the prominent T10, highest-first (all always visible).
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

/**
 * Tier count input — defined at MODULE SCOPE (not inside the parent component)
 * so its identity is stable across parent re-renders and it never remounts.
 *
 * It keeps its OWN local string state while the user types and only commits the
 * parsed number to the parent on blur (or Enter). This means keystrokes never
 * touch parent state, so the field keeps focus for continuous typing.
 */
function TierInput({
  value,
  prominent,
  ariaLabel,
  onCommit,
}: {
  value: number
  prominent?: boolean
  ariaLabel?: string
  onCommit: (n: number) => void
}) {
  const [local, setLocal] = useState<string>(value ? String(value) : '')

  // Re-seed local state when the committed value changes externally
  // (e.g. after save → router.refresh re-passes fresh props).
  useEffect(() => {
    setLocal(value ? String(value) : '')
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only mutate local state on keystroke — never the parent.
    setLocal(e.target.value.replace(/[^0-9]/g, ''))
  }

  function commit() {
    const n = local === '' ? 0 : parseInt(local, 10)
    onCommit(isNaN(n) ? 0 : n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={local}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder="—"
      aria-label={ariaLabel}
      className={`w-full ${prominent ? 'h-11 text-base' : 'h-9 text-sm'} px-2 text-center bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-200 placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  )
}

/**
 * One troop type section — also at module scope so it never remounts its inputs.
 * All tiers T1–T10 are always visible (static, no toggles).
 */
function TroopSection({
  type,
  typeData,
  onCount,
  onTg,
}: {
  type: TroopType
  typeData: TypeData
  onCount: (tier: TroopTier, n: number) => void
  onTg: (level: number) => void
}) {
  const tg = typeData.tg_level || 0
  const total = STANDARD_TIERS.reduce((s, t) => s + (typeData[t] || 0), 0)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      <p className="font-semibold text-slate-100">{TYPE_LABELS[type]}</p>

      {/* Truegold level — prominent at the top of each section */}
      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-amber-300">Truegold Level</label>
          <select
            value={tg}
            onChange={e => onTg(parseInt(e.target.value, 10))}
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

      {/* Troop counts by tier — all tiers always visible (static) */}
      <div className="space-y-2">
        {/* T10 first and most prominent */}
        <div className="flex items-center gap-2">
          <label className="w-10 text-sm font-semibold text-amber-400 shrink-0">T10</label>
          <div className="flex-1">
            <TierInput
              value={typeData.t10 || 0}
              prominent
              ariaLabel={`${TYPE_LABELS[type]} T10`}
              onCommit={n => onCount('t10', n)}
            />
          </div>
        </div>

        {/* T9 → T1, always shown */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 pt-1">
          {LOWER_TIERS.map(tier => (
            <div key={tier} className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-500 text-center uppercase">{tier}</label>
              <TierInput
                value={typeData[tier] || 0}
                ariaLabel={`${TYPE_LABELS[type]} ${tier.toUpperCase()}`}
                onCommit={n => onCount(tier, n)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Type total */}
      <div className="flex justify-between text-sm border-t border-slate-800 pt-2 text-slate-400">
        <span>Total {TYPE_LABELS[type]}:</span>
        <span className="font-semibold text-slate-200">{fmt(total)}</span>
      </div>
    </div>
  )
}

interface Props {
  accessToken: string
  existing?: any
  onSaved?: () => void
}

export function TroopDataEditor({ accessToken, existing, onSaved }: Props) {
  const router = useRouter()
  const [data, setData] = useState<TroopData>(() => mergeExisting(existing))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function setCount(type: TroopType, tier: TroopTier, n: number) {
    setData(d => ({ ...d, [type]: { ...d[type], [tier]: n } }))
  }

  function setTgLevel(type: TroopType, level: number) {
    setData(d => ({ ...d, [type]: { ...d[type], tg_level: level } }))
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
        {/* Three troop sections — all tiers always visible */}
        {TROOP_TYPES.map(type => (
          <TroopSection
            key={type}
            type={type}
            typeData={data[type]}
            onCount={(tier, n) => setCount(type, tier, n)}
            onTg={level => setTgLevel(type, level)}
          />
        ))}

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
