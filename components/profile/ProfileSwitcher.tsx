// @ts-nocheck
'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, UserPlus, Loader2 } from 'lucide-react'
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

export function ProfileSwitcher({ profiles }: { profiles: ProfileEntry[] }) {
  const [open, setOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const active = profiles.find(p => p.is_active_profile) || profiles[0]
  if (!active) {
    // No linked member yet — still offer linking an account.
    return (
      <>
        <button onClick={() => setLinking(true)} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-400 px-2 h-8 rounded-lg hover:bg-slate-800 transition-colors">
          <UserPlus size={14} /> <span className="hidden sm:inline">Link profile</span>
        </button>
        {linking && <LinkProfileFlow onClose={() => setLinking(false)} onLinked={() => { window.location.href = '/dashboard' }} />}
      </>
    )
  }

  async function switchTo(memberId: string) {
    if (memberId === active?.member_id) { setOpen(false); return }
    setSwitchingTo(memberId); setError('')
    try {
      const res = await fetch('/api/profile/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Switch failed'); setSwitchingTo(null); return }
      // Hard redirect so all server-side permissions refresh (no cached role).
      window.location.href = '/dashboard'
    } catch {
      setError('Network error'); setSwitchingTo(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 h-8 rounded-lg hover:bg-slate-800 transition-colors max-w-[160px]"
        title="Switch profile"
      >
        <PlayerAvatar gameId={active.game_id} avatarUrl={active.avatar_url} playerName={active.player_name} sizeClass="w-6 h-6" />
        <span className="text-xs font-medium text-slate-200 truncate hidden sm:block">{active.player_name}</span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[60] overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Your profiles</p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {profiles.map(p => (
              <button
                key={p.member_id}
                onClick={() => switchTo(p.member_id)}
                disabled={!!switchingTo}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${p.is_active_profile ? 'bg-amber-500/10' : 'hover:bg-slate-800'}`}
              >
                <PlayerAvatar gameId={p.game_id} avatarUrl={p.avatar_url} playerName={p.player_name} sizeClass="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">{p.player_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.alliance_tag ? `[${p.alliance_tag}] ${p.alliance_name}` : 'No alliance'} · {roleLabel(p.role)}
                  </p>
                </div>
                {switchingTo === p.member_id ? (
                  <Loader2 size={15} className="text-amber-400 animate-spin flex-shrink-0" />
                ) : p.is_active_profile ? (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold flex-shrink-0"><Check size={13} />Active</span>
                ) : null}
              </button>
            ))}
          </div>
          {error && <p className="px-3 py-1.5 text-xs text-red-400">{error}</p>}
          <button
            onClick={() => { setOpen(false); setLinking(true) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-amber-400 hover:bg-slate-800 border-t border-slate-800 transition-colors"
          >
            <UserPlus size={15} /> Link Another Profile
          </button>
        </div>
      )}

      {linking && <LinkProfileFlow onClose={() => setLinking(false)} onLinked={() => { window.location.href = '/dashboard' }} />}
    </div>
  )
}
