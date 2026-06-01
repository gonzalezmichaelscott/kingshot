// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserCheck, CheckCircle2, Clock } from 'lucide-react'

interface Props {
  memberId: string
  memberName: string
  hasPendingClaim: boolean
}

export function ClaimProfileBanner({ memberId, memberName, hasPendingClaim }: Props) {
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(hasPendingClaim)
  const [error, setError] = useState('')

  async function claim() {
    setClaiming(true)
    setError('')
    const res = await fetch('/api/profile-claim/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    setClaiming(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to send claim request')
      return
    }
    setClaimed(true)
  }

  if (claimed) {
    return (
      <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Clock size={18} className="text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-300">Claim request sent</p>
            <p className="text-xs text-slate-400">Your alliance R4/R5 will verify in-game and approve your request.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <UserCheck size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Is this your profile?</p>
            <p className="text-xs text-slate-400">This profile for <strong className="text-slate-300">{memberName}</strong> is not yet linked to any account.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" onClick={claim} disabled={claiming}>
            <UserCheck size={14} className="mr-1" />
            {claiming ? 'Sending…' : 'Claim This Profile'}
          </Button>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  )
}
