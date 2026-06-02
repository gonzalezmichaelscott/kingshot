// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeftRight } from 'lucide-react'

/**
 * R4/R5/admin toggle for a member's "willing to move for KVK" flag, set on the
 * member's behalf. Records the acting leader (see /api/member/willing-to-move)
 * and shows "Set by [leader name]" when it was set by a leader.
 */
export function AdminWillingToMoveToggle({
  memberId,
  initial,
  setByLeaderName,
}: {
  memberId: string
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
    await fetch('/api/member/willing-to-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, kvk_willing_to_move: v }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowLeftRight size={16} className="text-amber-500" />
          KVK Transfer Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
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
              Willing to move alliances for KVK
              {saved && <span className="text-green-400 text-xs">Saved ✓</span>}
            </span>
            <span className="block text-xs text-slate-400 mt-1 leading-relaxed">
              If enabled, battle planners may recommend this member temporarily join another
              alliance's rally during KVK for stronger coordination.
            </span>
            {on && setByLeaderName && (
              <span className="block text-[11px] text-amber-400/80 mt-1">Set by {setByLeaderName}</span>
            )}
          </span>
        </label>
      </CardContent>
    </Card>
  )
}
