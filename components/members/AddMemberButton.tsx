// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function AddMemberButton({ allianceId }: { allianceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [gameId, setGameId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingPlayer, setFetchingPlayer] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  async function fetchPlayerInfo(id: string) {
    if (!id.trim()) return
    setFetchingPlayer(true)
    try {
      const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(id.trim())}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.name && !name.trim()) {
          setName(json.data.name)
        }
      }
    } catch {
      // Silently ignore — player lookup is optional
    } finally {
      setFetchingPlayer(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('members').insert({
      alliance_id: allianceId,
      player_name: name.trim(),
      game_id: gameId.trim() || null,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    setName('')
    setGameId('')
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setName('')
    setGameId('')
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
              Player ID (optional) — in-game numeric ID shown under governor name
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 123456789"
                value={gameId}
                onChange={e => setGameId(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!gameId.trim() || fetchingPlayer}
                onClick={() => fetchPlayerInfo(gameId)}
              >
                {fetchingPlayer ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Click Fetch to auto-fill name from game</p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Player Name <span className="text-red-400">*</span></label>
            <Input
              autoFocus={!gameId}
              required
              placeholder="Governor name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading ? 'Adding…' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
