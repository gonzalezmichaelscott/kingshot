// @ts-nocheck
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Gift, RefreshCw, Loader2, Check, Copy, AlertCircle, Clock, ExternalLink } from 'lucide-react'

interface GiftCode {
  id: string
  code: string
  expiresAt: string | null
  createdAt: string | null
}

type Mode = 'redeem' | 'share'

interface Props {
  /** Member's stored Player ID — shown so they can paste it on the game site. */
  gameId?: string | null
  /** 'redeem' (default): members copy + open the game site to redeem.
   *  'share': R4/R5 view — copy buttons only. */
  mode?: Mode
}

const GAME_SITE_URL = 'https://ks-giftcode.centurygame.com'

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
  const [copied, setCopied] = useState('')      // which code was just copied
  const [copiedId, setCopiedId] = useState(false) // Player ID just copied

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

  function copyCode(code: string) {
    try { navigator.clipboard?.writeText(code) } catch { /* ignore */ }
    setCopied(code)
    setTimeout(() => setCopied(c => (c === code ? '' : c)), 1500)
  }

  function copyId() {
    if (!gameId) return
    try { navigator.clipboard?.writeText(String(gameId)) } catch { /* ignore */ }
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 1500)
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

      {/* Player ID + instructions (member redeem mode only) */}
      {mode === 'redeem' && (
        <>
          {gameId ? (
            <div className="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 flex-wrap">
              <p className="text-sm text-slate-300">
                Your Player ID: <span className="font-mono font-bold text-amber-300">{gameId}</span>
              </p>
              <button
                onClick={copyId}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors"
              >
                {copiedId ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                {copiedId ? 'Copied!' : 'Copy ID'}
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              Add your Player ID in the Stats tab to use this feature
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            To redeem: Copy your Player ID and the code, then click Redeem on Game Site. Paste both into the form to claim your rewards.
          </p>
        </>
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
          {active.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 bg-slate-800 border border-slate-700 rounded-xl p-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-mono font-bold text-base text-amber-300 tracking-wide break-all">{c.code}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fmtExpiry(c.expiresAt)}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <button
                  onClick={() => copyCode(c.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold transition-colors"
                >
                  {copied === c.code ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  <span className={copied === c.code ? 'text-green-400' : ''}>{copied === c.code ? 'Copied!' : 'Copy Code'}</span>
                </button>

                {mode === 'redeem' && (
                  <a
                    href={GAME_SITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <ExternalLink size={13} />
                    Redeem on Game Site
                  </a>
                )}
              </div>
            </div>
          ))}
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
