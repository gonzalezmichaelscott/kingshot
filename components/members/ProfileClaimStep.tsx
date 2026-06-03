// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, CheckCircle2, UserCheck } from 'lucide-react'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { formatPower } from '@/lib/utils'

interface FoundProfile {
  id: string
  player_name: string
  game_id: string | null
  power: number
  alliance: { name: string; tag: string } | null
  already_linked: boolean
  has_game_id: boolean
}

interface Props {
  allianceId: string
  allianceName: string
  onClaimed: () => void
  onSkip: () => void
}

export function ProfileClaimStep({ allianceId, allianceName, onClaimed, onSkip }: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [found, setFound] = useState<FoundProfile | null>(null)
  const [searchError, setSearchError] = useState('')

  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState('')

  async function search() {
    if (!/^\d+$/.test(query.trim())) {
      setSearchError('Enter a valid numeric Player ID')
      return
    }
    setSearching(true)
    setSearchError('')
    setFound(null)
    setSearched(false)

    const res = await fetch('/api/profile-claim/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alliance_id: allianceId, query: query.trim() }),
    })
    setSearching(false)
    setSearched(true)

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setSearchError(d.error || 'Search failed')
      return
    }
    const { member } = await res.json()
    setFound(member || null)
  }

  async function requestClaim() {
    if (!found) return
    setClaiming(true)
    setClaimError('')

    const res = await fetch('/api/profile-claim/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: found.id }),
    })
    setClaiming(false)

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setClaimError(d.error || 'Failed to send claim request')
      return
    }
    setClaimed(true)
    setTimeout(onClaimed, 2000)
  }

  if (claimed) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <CheckCircle2 className="mx-auto text-green-400" size={36} />
          <p className="font-medium">Claim request sent!</p>
          <p className="text-sm text-slate-400">Your alliance R4/R5 will verify and approve your request. You will be notified once it is approved.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-amber-500" />
          <p className="text-sm font-medium">Already have a profile in {allianceName}?</p>
        </div>
        <p className="text-xs text-slate-400">
          Enter your Player ID (the number shown under your governor name in-game).
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Player ID"
            value={query}
            onChange={e => setQuery(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <Button size="sm" onClick={search} disabled={searching || !query.trim()}>
            <Search size={14} className="mr-1" />
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </div>

        {searchError && <p className="text-red-400 text-xs">{searchError}</p>}

        {searched && !found && !searchError && (
          <p className="text-slate-400 text-xs">
            No profile found with that Player ID. Ask your R4/R5 to create your profile, or create a new one.
          </p>
        )}

        {found && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar gameId={found.game_id} playerName={found.player_name} sizeClass="w-10 h-10" />
              <div className="min-w-0">
                <p className="font-semibold">{found.player_name}</p>
                {found.game_id && <p className="text-xs text-slate-400">ID: {found.game_id}</p>}
                <p className="text-xs text-slate-400">
                  {found.alliance ? `[${found.alliance.tag}] ${found.alliance.name}` : ''} · Power: {formatPower(found.power)}
                </p>
              </div>
            </div>

            {found.already_linked ? (
              <p className="text-xs text-slate-400 bg-slate-800 rounded p-2">
                This profile is already linked to an account.
              </p>
            ) : (
              <>
                {claimError && <p className="text-red-400 text-xs">{claimError}</p>}
                <Button size="sm" className="w-full" onClick={requestClaim} disabled={claiming}>
                  {claiming ? 'Sending…' : 'Request to Claim This Profile'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-700" />
        <span className="text-xs text-slate-500">or</span>
        <div className="flex-1 border-t border-slate-700" />
      </div>

      <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-slate-200" onClick={onSkip}>
        Create a new profile instead
      </Button>
    </div>
  )
}
