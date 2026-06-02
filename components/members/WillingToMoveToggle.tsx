// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight } from 'lucide-react'

/**
 * "Willing to move alliances for KVK" toggle. Used on the member self-service
 * page (Stats tab) and the logged-in member dashboard. Saves through the
 * member stats endpoint using the member's own access token (self-set), which
 * clears any "set by leader" marker.
 */
export function WillingToMoveToggle({
  accessToken,
  initial,
  setByLeaderName,
}: {
  accessToken: string
  initial: boolean
  setByLeaderName?: string | null
}) {
  const [on, setOn] = useState(!!initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function toggle(v: boolean) {
    setOn(v)
    setSaving(true)
    await fetch('/api/member/stats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, kvk_willing_to_move: v }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          className="w-5 h-5 rounded accent-amber-500 mt-0.5 flex-shrink-0"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-sm text-slate-100">
            <ArrowLeftRight size={14} className="text-amber-400" />
            Willing to move alliances for KVK
            {saved && <span className="text-green-400 text-xs">Saved ✓</span>}
          </span>
          <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
            If enabled, battle planners may recommend you temporarily join another alliance's
            rally during KVK for stronger coordination.
          </span>
          {setByLeaderName && (
            <span className="block text-[11px] text-amber-400/80 mt-1">Set by {setByLeaderName}</span>
          )}
        </span>
      </label>
    </div>
  )
}
