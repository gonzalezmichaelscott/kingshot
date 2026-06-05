// @ts-nocheck
'use client'
// Renders the castle's multiple rallies (Rally 1/2/3), each with its own leader,
// joiner list, and capacity-fill status. Shared by the KVK hub structure board
// and the single-alliance Castle Battle event page (FIX 5).
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { Crown, Users } from 'lucide-react'
import type { CastleRally } from '@/lib/rally-fill'

function fmt(n: number) {
  return Math.round(n || 0).toLocaleString('en-US')
}

function ManualBadge() {
  return <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium">Manually assigned</span>
}

export function CastleRallies({ rallies }: { rallies: CastleRally[] }) {
  if (!rallies || rallies.length === 0) {
    return <p className="text-sm text-slate-500">No castle rally leaders assigned yet.</p>
  }

  return (
    <div className="space-y-3">
      {rallies.map(rally => (
        <div key={rally.index} className="rounded-lg border border-amber-500/30 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
              <Crown size={13} /> Rally {rally.index} — {rally.leader.tag ? `[${rally.leader.tag}] ` : ''}{rally.leader.player_name}
              {rally.leader.isManual && <ManualBadge />}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              {rally.incomplete
                ? 'Data incomplete — showing up to 15 joiners'
                : `${fmt(rally.used)} / ${fmt(rally.capacity)} capacity filled`}
            </p>
          </div>

          <div className="mt-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
              <Users size={11} /> Joiners ({rally.joiners.length})
            </p>
            {rally.joiners.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {rally.joiners.map(j => (
                  <div key={j.id} className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1.5">
                    <PlayerAvatar gameId={j.game_id} memberId={j.id} playerName={j.player_name} sizeClass="w-6 h-6" />
                    <span className="text-xs text-slate-300 truncate">{j.tag ? `[${j.tag}] ` : ''}{j.player_name}</span>
                    {j.march_size ? <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{fmt(j.march_size)}</span> : null}
                    {j.kvk_transfer && <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">KVK Transfer</span>}
                    {j.isManual && <ManualBadge />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No joiners assigned to this rally yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
