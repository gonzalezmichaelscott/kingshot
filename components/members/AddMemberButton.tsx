// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Loader2, Check, AlertTriangle, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { addableMemberRanks, isElevatedRank, roleLabel } from '@/lib/access'

type FetchStatus = 'idle' | 'fetching' | 'found' | 'failed'

export function AddMemberButton({ allianceId, actorRole }: { allianceId: string; actorRole?: string | null }) {
  const [open, setOpen] = useState(false)
  const [gameId, setGameId] = useState('')
  const [fetchedName, setFetchedName] = useState('')
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle')
  // FIX 3 — starting rank for the new member, gated by the actor's role.
  const rankOptions = addableMemberRanks(actorRole)
  const [role, setRole] = useState('r3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Fetch the player name from the game on demand. Triggered by the Search button
  // or by pressing Enter in the Player ID field — never automatically on keystroke.
  // The name is never entered manually.
  async function fetchName() {
    const id = gameId.trim()
    if (!id) { setFetchStatus('idle'); setFetchedName(''); return }
    setFetchStatus('fetching')
    setFetchedName('')
    try {
      const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(id)}`)
      if (res.ok) {
        const json = await res.json()
        const name = (json.data?.name || '').trim()
        if (name) { setFetchedName(name); setFetchStatus('found'); return }
      }
      setFetchStatus('failed')
    } catch {
      setFetchStatus('failed')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!gameId.trim()) return
    setLoading(true)
    setError('')
    // Route through the API so the role hierarchy is enforced server-side and
    // elevated ranks (r4/r5) go through the pending-approval flow.
    const res = await fetch('/api/members/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allianceId,
        gameId: gameId.trim(),
        // Use the fetched name, or blank if the lookup failed (fillable later).
        playerName: fetchedName.trim(),
        role,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to add member.')
      return
    }
    handleClose()
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setGameId('')
    setFetchedName('')
    setFetchStatus('idle')
    setRole('r3')
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
            <div className="flex gap-2">
              <Input
                autoFocus
                type="text"
                inputMode="numeric"
                placeholder="e.g. 123456789"
                value={gameId}
                onChange={e => {
                  setGameId(e.target.value.replace(/[^0-9]/g, ''))
                  // Editing the ID invalidates any previously fetched name.
                  setFetchStatus('idle')
                  setFetchedName('')
                }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchName() } }}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={fetchName}
                disabled={!gameId.trim() || fetchStatus === 'fetching'}
              >
                {fetchStatus === 'fetching'
                  ? <Loader2 size={14} className="animate-spin" />
                  : <><Search size={14} className="mr-1" /> Search</>}
              </Button>
            </div>

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

          {/* Member Rank — options depend on the actor's role (FIX 3) */}
          {rankOptions.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Member Rank</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {rankOptions.map(r => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
              {isElevatedRank(role) && (
                <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Leadership ranks require approval — this member is added at R3 and the {roleLabel(role)} rank is sent for approval.
                </p>
              )}
            </div>
          )}

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
