// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Loader2, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type FetchStatus = 'idle' | 'fetching' | 'found' | 'failed'

export function AddMemberButton({ allianceId }: { allianceId: string }) {
  const [open, setOpen] = useState(false)
  const [gameId, setGameId] = useState('')
  const [fetchedName, setFetchedName] = useState('')
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // FIX 2 — auto-fetch the player name from the game whenever the Player ID
  // changes (debounced). The name is never entered manually.
  useEffect(() => {
    const id = gameId.trim()
    if (!id) { setFetchStatus('idle'); setFetchedName(''); return }
    setFetchStatus('fetching')
    setFetchedName('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    let cancelled = false
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(id)}`)
        if (cancelled) return
        if (res.ok) {
          const json = await res.json()
          const name = (json.data?.name || '').trim()
          if (name) { setFetchedName(name); setFetchStatus('found'); return }
        }
        setFetchStatus('failed')
      } catch {
        if (!cancelled) setFetchStatus('failed')
      }
    }, 500)
    return () => { cancelled = true; if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [gameId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!gameId.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('members').insert({
      alliance_id: allianceId,
      // Use the fetched name, or blank if the lookup failed (fillable later).
      player_name: fetchedName.trim(),
      game_id: gameId.trim(),
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    handleClose()
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setGameId('')
    setFetchedName('')
    setFetchStatus('idle')
    setError('')
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus size={16} className="mr-1" /> Add Member
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">Add Member</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Player ID <span className="text-red-400">*</span> — in-game numeric ID shown under governor name
            </label>
            <Input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="e.g. 123456789"
              value={gameId}
              onChange={e => setGameId(e.target.value.replace(/[^0-9]/g, ''))}
            />

            {/* Name fetch status */}
            {fetchStatus === 'fetching' && (
              <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Fetching name…
              </p>
            )}
            {fetchStatus === 'found' && (
              <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1.5">
                <Check size={12} /> Found: {fetchedName}
              </p>
            )}
            {fetchStatus === 'failed' && (
              <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Could not fetch name — member will be added with blank name
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading || !gameId.trim() || fetchStatus === 'fetching'}>
              {loading ? 'Adding…' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
