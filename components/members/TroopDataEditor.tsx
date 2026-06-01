// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sword } from 'lucide-react'

const STANDARD_TIERS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10'] as const
const TRUE_GOLD_TIERS = ['TG1','TG2','TG3','TG4','TG5','TG6','TG7','TG8'] as const
const ALL_TIERS = [...STANDARD_TIERS, ...TRUE_GOLD_TIERS] as const
const TROOP_TYPES = ['infantry', 'cavalry', 'archer'] as const

type TroopTier = (typeof ALL_TIERS)[number]
type TroopType = (typeof TROOP_TYPES)[number]
export type TroopData = Record<TroopType, Partial<Record<TroopTier, number>>>

const TYPE_LABELS: Record<TroopType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  archer: 'Archers',
}

function emptyTroopData(): TroopData {
  const base = ALL_TIERS.reduce((a, t) => ({ ...a, [t]: 0 }), {} as Partial<Record<TroopTier, number>>)
  return {
    infantry: { ...base },
    cavalry: { ...base },
    archer: { ...base },
  }
}

function mergeExisting(existing: any): TroopData {
  const base = emptyTroopData()
  if (!existing || typeof existing !== 'object') return base
  for (const type of TROOP_TYPES) {
    const src = existing[type]
    if (src && typeof src === 'object') {
      for (const tier of ALL_TIERS) {
        const v = Number(src[tier])
        if (!isNaN(v) && v > 0) base[type][tier] = v
      }
    }
  }
  return base
}

function typeTotal(data: TroopData, type: TroopType): number {
  return ALL_TIERS.reduce((s, t) => s + (data[type][t] || 0), 0)
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
  const [activeType, setActiveType] = useState<TroopType>('infantry')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function setCount(type: TroopType, tier: TroopTier, raw: string) {
    const digits = raw.replace(/[^0-9]/g, '')
    const n = digits === '' ? 0 : parseInt(digits, 10)
    setData(d => ({ ...d, [type]: { ...d[type], [tier]: isNaN(n) ? 0 : n } }))
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
        {/* Troop type tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {TROOP_TYPES.map(type => {
            const t = typeTotal(data, type)
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                  activeType === type
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{TYPE_LABELS[type]}</span>
                {t > 0 && (
                  <span className="text-[10px] opacity-80 mt-0.5">{fmt(t)}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Standard Troops */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Standard Troops
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {STANDARD_TIERS.map(tier => (
              <div key={tier} className="flex flex-col gap-0.5">
                <label className="text-[10px] text-slate-500 text-center">{tier}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValue(activeType, tier)}
                  onChange={e => setCount(activeType, tier, e.target.value)}
                  placeholder="—"
                  className="w-full h-9 px-1 text-center text-sm bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-200 placeholder-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* True Gold Troops */}
        <div>
          <p className="text-xs font-semibold text-amber-500/80 uppercase tracking-wide mb-2">
            True Gold Troops
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {TRUE_GOLD_TIERS.map(tier => (
              <div key={tier} className="flex flex-col gap-0.5">
                <label className="text-[10px] text-amber-600 text-center">{tier}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputValue(activeType, tier)}
                  onChange={e => setCount(activeType, tier, e.target.value)}
                  placeholder="—"
                  className="w-full h-9 px-1 text-center text-sm bg-slate-800 border border-amber-900/50 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-amber-100 placeholder-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Type total */}
        <div className="flex justify-between text-sm border-t border-slate-800 pt-2 text-slate-400">
          <span>{TYPE_LABELS[activeType]} total:</span>
          <span className="font-semibold text-slate-200">{fmt(typeTotal(data, activeType))}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Save Troop Data'}
        </Button>
      </CardContent>
    </Card>
  )
}
