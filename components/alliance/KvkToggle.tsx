// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Power } from 'lucide-react'

interface Props {
  allianceId: string
  initialEnabled: boolean
  canToggle: boolean
}

export function KvkToggle({ allianceId, initialEnabled, canToggle }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function toggle() {
    if (!canToggle || loading) return
    setLoading(true)
    setError('')
    const next = !enabled
    try {
      const res = await fetch('/api/alliance/kvk-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allianceId, enabled: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      setEnabled(next)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold flex items-center gap-2">
            <Power size={16} className={enabled ? 'text-green-400' : 'text-slate-500'} />
            KVK Participation
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Enable to join your kingdom&apos;s KVK coordination hub and share your alliance data with other participating alliances.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={toggle}
            disabled={!canToggle || loading}
            aria-pressed={enabled}
            className={
              'inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium transition-colors ' +
              (enabled
                ? 'bg-green-600/20 text-green-400 border border-green-600/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700') +
              (canToggle ? ' hover:opacity-80 cursor-pointer' : ' cursor-default opacity-90')
            }
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {enabled ? 'KVK: Enabled' : 'KVK: Disabled'}
          </button>
          {canToggle ? (
            <span className="text-xs text-slate-500">Click to {enabled ? 'disable' : 'enable'}</span>
          ) : (
            <span className="text-xs text-slate-500">Only R5 can change this</span>
          )}
        </div>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
