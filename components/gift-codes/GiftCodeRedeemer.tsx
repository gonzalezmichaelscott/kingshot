// @ts-nocheck
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Gift, RefreshCw, Loader2, Check, Copy, AlertCircle, Clock } from 'lucide-react'

interface GiftCode {
  id: string
  code: string
  expiresAt: string | null
  createdAt: string | null
}

type Mode = 'redeem' | 'share'

interface Props {
  /** Member's stored Player ID — required for one-click redemption. */
  gameId?: string | null
  /** 'redeem' (default): members redeem with their Player ID.
   *  'share': R4/R5 view — copy buttons only, no redemption. */
  mode?: Mode
}

const LS_KEY = 'ks_redeemed_gift_codes'
const MANUAL_FALLBACK =
  'Redemption service unavailable — try redeeming at ks-giftcode.centurygame.com manually'

function loadRedeemed(): Record<string, true> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function saveRedeemed(map: Record<string, true>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

function fmtExpiry(iso: string | null): string {
  if (!iso) return 'No expiry'
  const t = Date.parse(iso)
  if (isNaN(t)) return 'No expiry'
  return 'Expires ' + new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function isActive(c: GiftCode): boolean {
  if (!c.expiresAt) return true
  const t = Date.parse(c.expiresAt)
  if (isNaN(t)) return true
  return t > Date.now()
}

export function GiftCodeRedeemer({ gameId, mode = 'redeem' }: Props) {
  const [codes, setCodes] = useState<GiftCode[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceError, setServiceError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [redeemed, setRedeemed] = useState<Record<string, true>>({})
  const [redeeming, setRedeeming] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [copied, setCopied] = useState('')

  // Load previously-redeemed codes from localStorage on mount.
  useEffect(() => { setRedeemed(loadRedeemed()) }, [])

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    setServiceError('')
    try {
      const res = await fetch('/api/gift-codes')
      const json = await res.json()
      setCodes(Array.isArray(json.giftCodes) ? json.giftCodes : [])
      if (json.error) setServiceError(json.error)
      setLastUpdated(new Date())
    } catch {
      setCodes([])
      setServiceError('Could not load gift codes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  const active = codes.filter(isActive)

  async function redeem(c: GiftCode) {
    if (!gameId) return
    setRedeeming(p => ({ ...p, [c.code]: true }))
    setResults(p => { const n = { ...p }; delete n[c.code]; return n })
    try {
      const res = await fetch('/api/gift-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: gameId, code: c.code }),
      })
      const json = await res.json().catch(() => ({}))
      const success = !!json.success
      const already = !!json.alreadyRedeemed
      setResults(p => ({
        ...p,
        [c.code]: { success: success || already, message: json.message || (success ? '✓ Redeemed!' : 'Redemption failed') },
      }))
      if (success || already) {
        setRedeemed(prev => {
          const next = { ...prev, [c.code]: true as const }
          saveRedeemed(next)
          return next
        })
      }
    } catch {
      setResults(p => ({ ...p, [c.code]: { success: false, message: MANUAL_FALLBACK } }))
    } finally {
      setRedeeming(p => ({ ...p, [c.code]: false }))
    }
  }

  function copy(code: string) {
    try { navigator.clipboard?.writeText(code) } catch { /* ignore */ }
    setCopied(code)
    setTimeout(() => setCopied(c => (c === code ? '' : c)), 1500)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="flex items-center gap-2 font-semibold text-slate-100">
          <Gift size={18} className="text-amber-500" />
          Active Gift Codes
        </h3>
        <button
          onClick={fetchCodes}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200 transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh Codes
        </button>
      </div>

      {lastUpdated && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock size={10} />
          Last updated {lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Soft service error (degraded but usable) */}
      {serviceError && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0" />
          {serviceError} — showing what we have. Try Refresh shortly.
        </div>
      )}

      {/* Loading */}
      {loading && active.length === 0 && (
        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-6">
          <Loader2 size={16} className="animate-spin" /> Loading gift codes…
        </div>
      )}

      {/* Empty */}
      {!loading && active.length === 0 && (
        <p className="text-sm text-slate-400 py-4 text-center">
          No active gift codes right now — check back later
        </p>
      )}

      {/* Codes */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(c => {
            const result = results[c.code]
            const isRedeeming = !!redeeming[c.code]
            const wasRedeemed = !!redeemed[c.code]

            return (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-base text-amber-300 tracking-wide break-all">{c.code}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{fmtExpiry(c.expiresAt)}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {mode === 'share' ? (
                    <button
                      onClick={() => copy(c.code)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {copied === c.code ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      {copied === c.code ? 'Copied' : 'Copy Code'}
                    </button>
                  ) : isRedeeming ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400">
                      <Loader2 size={13} className="animate-spin" /> Redeeming…
                    </span>
                  ) : result ? (
                    result.success ? (
                      <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                        <Check size={13} /> {result.message}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400 max-w-[200px]">{result.message}</span>
                        <button
                          onClick={() => redeem(c)}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Try again
                        </button>
                      </div>
                    )
                  ) : wasRedeemed ? (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Check size={13} /> Already redeemed
                    </span>
                  ) : !gameId ? (
                    <span className="text-xs text-slate-400 max-w-[220px] text-right">
                      Add your Player ID to your profile to redeem codes automatically
                    </span>
                  ) : (
                    <button
                      onClick={() => redeem(c)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Redeem
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'share' && active.length > 0 && (
        <p className="text-[11px] text-slate-500">
          Share these with your members — each member must redeem the code themselves with their own Player ID.
        </p>
      )}
    </div>
  )
}
