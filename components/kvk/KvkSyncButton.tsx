// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

/**
 * "Sync Attendance" — re-fetches all attendance data for the KVK hub (server
 * components re-run on router.refresh) and shows when it was last synced.
 */
export function KvkSyncButton() {
  const router = useRouter()
  const [last, setLast] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  // Treat initial page load as the first sync.
  useEffect(() => { setLast(new Date()) }, [])

  function sync() {
    setLoading(true)
    router.refresh()
    setLast(new Date())
    setTimeout(() => setLoading(false), 600)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={sync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Sync Attendance
      </button>
      {last && (
        <span className="text-xs text-slate-500">
          Last synced: {last.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  )
}
