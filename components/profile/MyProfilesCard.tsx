// @ts-nocheck
'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserPlus, Check, Loader2 } from 'lucide-react'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { LinkProfileFlow } from '@/components/profile/LinkProfileFlow'
import { roleLabel } from '@/lib/access'

interface ProfileEntry {
  member_id: string
  player_name: string
  game_id: string | null
  avatar_url: string | null
  alliance_tag: string | null
  alliance_name: string | null
  role: string | null
  is_active_profile: boolean
}

export function MyProfilesCard({ profiles }: { profiles: ProfileEntry[] }) {
  const [linking, setLinking] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function switchTo(memberId: string, isActive: boolean) {
    if (isActive) return
    setSwitchingTo(memberId); setError('')
    try {
      const res = await fetch('/api/profile/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Switch failed'); setSwitchingTo(null); return }
      window.location.href = '/dashboard'
    } catch {
      setError('Network error'); setSwitchingTo(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users size={18} className="text-amber-500" />
          My Profiles
          <span className="text-xs font-normal text-slate-500">({profiles.length}/5)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {profiles.map(p => (
          <button
            key={p.member_id}
            onClick={() => switchTo(p.member_id, p.is_active_profile)}
            disabled={!!switchingTo || p.is_active_profile}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
              p.is_active_profile ? 'border-amber-500/50 bg-amber-500/10 cursor-default' : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
            }`}
          >
            <PlayerAvatar gameId={p.game_id} avatarUrl={p.avatar_url} playerName={p.player_name} sizeClass="w-9 h-9" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.player_name}</p>
              <p className="text-xs text-slate-400 truncate">
                {p.alliance_tag ? `[${p.alliance_tag}] ${p.alliance_name}` : 'No alliance'} · {roleLabel(p.role)}
              </p>
            </div>
            {switchingTo === p.member_id ? (
              <Loader2 size={15} className="text-amber-400 animate-spin flex-shrink-0" />
            ) : p.is_active_profile ? (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold flex-shrink-0"><Check size={13} />Active</span>
            ) : (
              <span className="text-[11px] text-slate-500 flex-shrink-0">Switch</span>
            )}
          </button>
        ))}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {profiles.length < 5 && (
          <button
            onClick={() => setLinking(true)}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-700 text-sm text-amber-400 hover:bg-slate-800/50 transition-colors"
          >
            <UserPlus size={15} /> Link Another Profile
          </button>
        )}
      </CardContent>

      {linking && <LinkProfileFlow onClose={() => setLinking(false)} onLinked={() => { window.location.href = '/dashboard' }} />}
    </Card>
  )
}
