// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, UserPlus, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { formatPower } from '@/lib/utils'

interface Props {
  onClose: () => void
  /** Called after a successful claim — caller usually hard-reloads. */
  onLinked: () => void
}

type SearchResult =
  | { status: 'available' | 'already_yours' | 'claimed_by_other'; member: any }
  | { status: 'not_found' }
  | null

export function LinkProfileFlow({ onClose, onLinked }: Props) {
  const [playerId, setPlayerId] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<SearchResult>(null)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)

  async function search() {
    if (!/^\d+$/.test(playerId.trim())) { setError('Enter a valid numeric Player ID'); return }
    setSearching(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/profile/link/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: playerId.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Search failed'); return }
      setResult(d)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSearching(false)
    }
  }

  async function claim(memberId: string) {
    setClaiming(true); setError('')
    try {
      const res = await fetch('/api/profile/link/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Failed to claim profile'); return }
      setClaimed(true)
      setTimeout(onLinked, 1200)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800">
          <h2 className="font-semibold flex items-center gap-2"><UserPlus size={18} className="text-amber-500" />Link Another Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {claimed ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="mx-auto text-green-400" size={40} />
              <p className="font-medium">Profile linked!</p>
              <p className="text-sm text-slate-400">It now appears in your profile switcher.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Enter the Player ID of your other account</label>
                <div className="flex gap-2">
                  <Input
                    type="text" inputMode="numeric" pattern="[0-9]*" placeholder="e.g. 123456789"
                    value={playerId}
                    onChange={e => { setPlayerId(e.target.value.replace(/[^0-9]/g, '')); setResult(null) }}
                    onKeyDown={e => e.key === 'Enter' && search()}
                  />
                  <Button size="sm" onClick={search} disabled={searching || !playerId.trim()}>
                    <Search size={14} className="mr-1" />{searching ? 'Searching…' : 'Search'}
                  </Button>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {/* Found + available to claim */}
              {result?.status === 'available' && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-3">
                  <ProfileCard member={result.member} />
                  <Button className="w-full" size="sm" onClick={() => claim(result.member.id)} disabled={claiming}>
                    {claiming ? 'Linking…' : 'Claim This Profile'}
                  </Button>
                  {!result.member.has_alliance && (
                    <p className="text-xs text-slate-500">This profile is not in an alliance — after linking, join one through the normal flow to gain access.</p>
                  )}
                </div>
              )}

              {/* Already linked to this account */}
              {result?.status === 'already_yours' && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2">
                  <ProfileCard member={result.member} />
                  <p className="text-xs text-green-300 flex items-center gap-1.5"><CheckCircle2 size={13} />This profile is already linked to your account.</p>
                </div>
              )}

              {/* Claimed by someone else */}
              {result?.status === 'claimed_by_other' && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3 space-y-2">
                  <ProfileCard member={result.member} />
                  <p className="text-sm text-red-200 flex items-start gap-1.5">
                    <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" />
                    This profile is already linked to a different account. If you believe this is an error, please use the Report Impersonation form.
                  </p>
                  <Link href="/report-impersonation" className="inline-block text-sm font-medium text-amber-400 hover:text-amber-300">
                    Report Impersonation →
                  </Link>
                </div>
              )}

              {/* Nothing found */}
              {result?.status === 'not_found' && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2">
                  <p className="text-sm text-slate-300 flex items-start gap-1.5">
                    <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    No profile found with that Player ID. You can create a new profile through the onboarding flow.
                  </p>
                  <Link
                    href={`/onboarding?alt=1&playerId=${encodeURIComponent(playerId.trim())}`}
                    className="inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
                  >
                    Set up new profile →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ member }: { member: any }) {
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar gameId={member.game_id} avatarUrl={member.avatar_url} playerName={member.player_name} sizeClass="w-10 h-10" />
      <div className="min-w-0">
        <p className="font-semibold truncate">{member.player_name}</p>
        {member.game_id && <p className="text-xs text-slate-400">ID: {member.game_id}</p>}
        <p className="text-xs text-slate-400">
          {member.alliance ? `[${member.alliance.tag}] ${member.alliance.name}` : 'No alliance'} · Power: {formatPower(member.power)}
        </p>
      </div>
    </div>
  )
}
