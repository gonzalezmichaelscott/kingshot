// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Clock, UserCheck, Unlink } from 'lucide-react'

interface Props {
  memberId: string
  linkedAccount: { email?: string; display_name?: string } | null
  pendingClaim: { id: string; requester_name: string; created_at: string } | null
  accessToken: string
  canUnlink: boolean
  appUrl: string
}

export function ProfileStatusCard({
  memberId,
  linkedAccount,
  pendingClaim,
  accessToken,
  canUnlink,
  appUrl,
}: Props) {
  const router = useRouter()
  const [unlinking, setUnlinking] = useState(false)
  const [approving, setApproving] = useState(false)

  const selfServiceLink = `${appUrl}/member/${accessToken}`

  async function handleUnlink() {
    if (!confirm('Unlink this account from the member profile? The player will need to re-claim it.')) return
    setUnlinking(true)
    const res = await fetch(`/api/members/${memberId}/unlink`, { method: 'POST' })
    setUnlinking(false)
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Unlink failed')
    }
  }

  async function handleClaim(action: 'approve' | 'reject') {
    if (!pendingClaim) return
    let rejection_reason = ''
    if (action === 'reject') {
      rejection_reason = window.prompt('Optional reason for rejection:') || ''
    }
    setApproving(true)
    const res = await fetch('/api/profile-claim/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: pendingClaim.id, action, rejection_reason }),
    })
    setApproving(false)
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Action failed')
    }
  }

  // Green — linked
  if (linkedAccount) {
    return (
      <Card className="border-green-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield size={16} className="text-green-400" />
            Profile Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-sm font-medium text-green-300">Account Linked</span>
          </div>
          <p className="text-xs text-slate-400">
            {linkedAccount.display_name
              ? `${linkedAccount.display_name}${linkedAccount.email ? ` (${linkedAccount.email})` : ''}`
              : linkedAccount.email || 'Account linked'}
          </p>
          {canUnlink && (
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-1" onClick={handleUnlink} disabled={unlinking}>
              <Unlink size={14} className="mr-1" />
              {unlinking ? 'Unlinking…' : 'Unlink Account'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Orange — pending claim
  if (pendingClaim) {
    return (
      <Card className="border-amber-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            Profile Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-300">Pending Claim</span>
          </div>
          <p className="text-xs text-slate-400">
            Claim requested by{' '}
            <span className="text-slate-200">{pendingClaim.requester_name}</span>
            {' '}on {new Date(pendingClaim.created_at).toLocaleDateString()}
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={() => handleClaim('approve')} disabled={approving}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => handleClaim('reject')} disabled={approving}>Reject</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Blue — awaiting claim
  return (
    <Card className="border-blue-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCheck size={16} className="text-blue-400" />
          Profile Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-300">Awaiting Claim</span>
        </div>
        <p className="text-xs text-slate-400">No account linked yet. Send this link to the player in-game:</p>
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
          <code className="text-xs text-slate-300 truncate flex-1 min-w-0">{selfServiceLink}</code>
          <button
            onClick={() => navigator.clipboard.writeText(selfServiceLink)}
            className="text-xs text-amber-400 hover:text-amber-300 flex-shrink-0"
          >
            Copy
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
