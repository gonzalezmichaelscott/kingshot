// @ts-nocheck
'use client'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sword, Upload, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface StatFields {
  infantry_attack: number
  infantry_defense: number
  infantry_health: number
  infantry_lethality: number
  cavalry_attack: number
  cavalry_defense: number
  cavalry_health: number
  cavalry_lethality: number
  archer_attack: number
  archer_defense: number
  archer_health: number
  archer_lethality: number
  troop_type_primary: string
}

const EMPTY_STATS: StatFields = {
  infantry_attack: 0, infantry_defense: 0, infantry_health: 0, infantry_lethality: 0,
  cavalry_attack: 0, cavalry_defense: 0, cavalry_health: 0, cavalry_lethality: 0,
  archer_attack: 0, archer_defense: 0, archer_health: 0, archer_lethality: 0,
  troop_type_primary: 'infantry',
}

const TROOP_TYPES = ['infantry', 'cavalry', 'archer', 'mixed']

const STAT_ROWS = [
  { type: 'infantry', label: 'Infantry', color: 'text-red-400' },
  { type: 'cavalry', label: 'Cavalry', color: 'text-blue-400' },
  { type: 'archer', label: 'Archer', color: 'text-green-400' },
] as const

interface Props {
  memberId: string
  accessToken: string
  existing?: any
}

export function CombatStatsEditor({ memberId, accessToken, existing }: Props) {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<StatFields>({
    infantry_attack: existing?.infantry_attack || 0,
    infantry_defense: existing?.infantry_defense || 0,
    infantry_health: existing?.infantry_health || 0,
    infantry_lethality: existing?.infantry_lethality || 0,
    cavalry_attack: existing?.cavalry_attack || 0,
    cavalry_defense: existing?.cavalry_defense || 0,
    cavalry_health: existing?.cavalry_health || 0,
    cavalry_lethality: existing?.cavalry_lethality || 0,
    archer_attack: existing?.archer_attack || 0,
    archer_defense: existing?.archer_defense || 0,
    archer_health: existing?.archer_health || 0,
    archer_lethality: existing?.archer_lethality || 0,
    troop_type_primary: existing?.troop_type_primary || 'infantry',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // Local copy of the saved stats so the read-only summary reflects what was just
  // saved immediately, without waiting on a server re-fetch. Synced from props.
  const [savedExisting, setSavedExisting] = useState<any>(existing || null)
  useEffect(() => { setSavedExisting(existing || null) }, [existing])
  const [ocrState, setOcrState] = useState<'idle' | 'uploading' | 'review' | 'no_key'>('idle')
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function setStat(key: keyof StatFields, value: number | string) {
    setStats(s => ({ ...s, [key]: value }))
    setSaved(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrState('uploading')
    setOcrMessage('')
    // Reset the input so the same file can be re-uploaded
    e.target.value = ''

    try {
      // Single consolidated OCR endpoint: multipart upload with full server-side
      // validation (magic bytes, size) and oversized-image resize.
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr/battle-stats', { method: 'POST', body: form })
      const data = await res.json()

      setOcrMessage(data.message || '')

      if (data.manual_entry_required) {
        setOcrState('no_key')
        return
      }

      // Merge OCR fields into form for review — never auto-save
      if (data.fields && Object.keys(data.fields).length > 0) {
        setStats(s => {
          const next = { ...s }
          for (const [k, v] of Object.entries(data.fields)) {
            if (k in next) (next as any)[k] = v
          }
          return next
        })
        setOcrConfidence(data.confidence || {})
        setOcrState('review')
      } else {
        setOcrMessage('No stats found in image. Please enter manually.')
        setOcrState('review')
      }
    } catch {
      setOcrMessage('OCR failed — please enter stats manually.')
      setOcrState('no_key')
    }
  }

  async function save() {
    setSaving(true)
    setError('')

    // The 12 combat fields are held as raw strings while editing (to preserve
    // partial decimals) — coerce them to numbers before sending so the zod
    // z.number() schema accepts them. troop_type_primary stays a string.
    const numericStats: Record<string, any> = { ...stats }
    for (const { type } of STAT_ROWS) {
      for (const stat of ['attack', 'defense', 'health', 'lethality']) {
        const k = `${type}_${stat}`
        numericStats[k] = Number(stats[k as keyof StatFields]) || 0
      }
    }

    const res = await fetch('/api/member/combat-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        ...numericStats,
        source: ocrState === 'review' ? 'ocr_verified' : 'manual',
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Save failed — your combat stats were not updated. Please try again.')
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setOcrState('idle')
    setOcrConfidence({})
    // Immediately reflect the saved values so the read-only summary shows them
    // without waiting on the server re-fetch.
    setSavedExisting({ ...stats, source: ocrState === 'review' ? 'ocr_verified' : 'manual' })
    setTimeout(() => setSaved(false), 2000)
    // Also re-sync server data (page is force-dynamic, so this returns fresh rows).
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sword size={16} className="text-amber-500" />
            Battle Report Stats
          </CardTitle>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400"
          >
            {open ? <><ChevronUp size={16} />Collapse</> : <><ChevronDown size={16} />{savedExisting ? 'Edit' : 'Add Stats'}</>}
          </button>
        </div>
      </CardHeader>

      {/* Read-only summary when closed */}
      {!open && savedExisting && (
        <CardContent>
          <div className="table-scroll">
            <table className="w-full min-w-[380px] text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-1.5 pr-4">Type</th>
                  <th className="text-right py-1.5 pr-2">ATK</th>
                  <th className="text-right py-1.5 pr-2">DEF</th>
                  <th className="text-right py-1.5 pr-2">HP</th>
                  <th className="text-right py-1.5">LETH</th>
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map(({ type, label, color }) => (
                  <tr key={type} className="border-b border-slate-800/40">
                    <td className={`py-1.5 pr-4 font-medium text-xs ${color}`}>{label}</td>
                    <td className="text-right py-1.5 pr-2 text-slate-300">{Number(savedExisting[`${type}_attack`] || 0).toFixed(2)}%</td>
                    <td className="text-right py-1.5 pr-2 text-slate-300">{Number(savedExisting[`${type}_defense`] || 0).toFixed(2)}%</td>
                    <td className="text-right py-1.5 pr-2 text-slate-300">{Number(savedExisting[`${type}_health`] || 0).toFixed(2)}%</td>
                    <td className="text-right py-1.5 text-amber-400">{Number(savedExisting[`${type}_lethality`] || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {savedExisting.source && (
            <p className="text-xs text-slate-500 mt-2">Source: {savedExisting.source}</p>
          )}
        </CardContent>
      )}

      {!open && !savedExisting && (
        <CardContent>
          <p className="text-slate-400 text-sm">No combat stats yet. Click Edit to add.</p>
        </CardContent>
      )}

      {open && (
        <CardContent className="space-y-5">
          {/* How to get stats explainer */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex gap-2">
            <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">
              <strong>How to get battle report stats:</strong> Temporarily leave your alliance, garrison a resource mine, then have alliance members attack you. After the battle, check your battle report for these stats. Enter them here or upload a screenshot to auto-extract.
            </p>
          </div>

          {/* OCR Upload */}
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Upload Battle Report Screenshot</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {ocrState === 'uploading' && (
              <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-3">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                Extracting stats from image…
              </div>
            )}
            {ocrState !== 'uploading' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} className="mr-1.5" />
                📷 Scan Screenshot
              </Button>
            )}
            {(ocrState === 'no_key' || ocrState === 'review') && ocrMessage && (
              <div className={`mt-2 flex items-start gap-2 text-xs rounded-lg p-2 ${
                ocrState === 'review'
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
              }`}>
                {ocrState === 'review'
                  ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                }
                {ocrMessage}
              </div>
            )}
          </div>

          {/* Primary troop type */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Primary Troop Type</label>
            <div className="flex gap-2 flex-wrap">
              {TROOP_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStat('troop_type_primary', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    stats.troop_type_primary === t
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Stats table editor */}
          <div className="table-scroll">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 text-xs">
                  <th className="text-left py-2 pr-3 w-24">Troop Type</th>
                  <th className="py-2 pr-2">
                    <span className="text-amber-400">ATK %</span>
                  </th>
                  <th className="py-2 pr-2">
                    <span className="text-slate-300">DEF %</span>
                  </th>
                  <th className="py-2 pr-2">
                    <span className="text-slate-300">HP %</span>
                  </th>
                  <th className="py-2">
                    <span className="text-amber-300">LETH % ⚡</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map(({ type, label, color }) => (
                  <tr key={type} className="border-b border-slate-800/40">
                    <td className={`py-2 pr-3 font-medium text-xs ${color}`}>{label}</td>
                    {(['attack', 'defense', 'health', 'lethality'] as const).map(stat => {
                      const key = `${type}_${stat}` as keyof StatFields
                      const conf = ocrConfidence[key]
                      return (
                        <td key={stat} className="py-1.5 pr-2">
                          <div className="relative">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={stats[key]}
                              onChange={e => {
                                // Keep the raw string while typing so a trailing
                                // "." or partial decimal (e.g. "306." → "306.6")
                                // isn't stripped by premature number parsing.
                                // Allow digits and up to 2 decimal places; coerced
                                // to a number on save.
                                const v = e.target.value.replace(/[^0-9.]/g, '')
                                if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setStat(key, v)
                              }}
                              className={`h-8 text-xs pr-6 ${conf !== undefined && conf < 0.7 ? 'border-amber-500/50' : ''}`}
                            />
                            {conf !== undefined && (
                              <span className={`absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold ${conf >= 0.8 ? 'text-green-400' : 'text-amber-400'}`}>
                                {Math.round(conf * 100)}%
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ocrState === 'review' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              <strong>⚠ Review required:</strong> OCR extracted the values above. Confidence shown as % next to each field. Please verify all values are correct before saving — never rely solely on OCR.
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              <Sword size={14} className="mr-1" />
              {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Save Combat Stats'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
