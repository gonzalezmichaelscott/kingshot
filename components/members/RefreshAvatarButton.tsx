'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Check } from 'lucide-react'

interface Props {
  memberId: string
}

// FIX 8 — force a fresh avatar fetch from the game API and update the cache.
// R4/R5/system_admin only (enforced server-side).
export function RefreshAvatarButton({ memberId }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function refresh() {
    setState('loading')
    setError('')
    const res = await fetch('/api/member/refresh-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to refresh avatar')
      setState('error')
      return
    }
    setState('done')
    router.refresh()
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <span className="inline-flex items-center gap-2 mt-1">
      <button
        onClick={refresh}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-50"
      >
        {state === 'done'
          ? <Check size={12} className="text-green-400" />
          : <RefreshCw size={12} className={state === 'loading' ? 'animate-spin' : ''} />}
        {state === 'loading' ? 'Refreshing…' : state === 'done' ? 'Avatar updated' : 'Refresh Avatar'}
      </button>
      {state === 'error' && <span className="text-xs text-red-400">{error}</span>}
    </span>
  )
}
