// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserCheck, Check, X } from 'lucide-react'

interface ClaimRequest {
  id: string
  member_id: string
  requesting_user_id: string
  created_at: string
  members: { player_name: string; game_id: string | null } | null
  requester: { display_name: string | null; email?: string } | null
}

export function PendingClaimRequests({ requests }: { requests: ClaimRequest[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  if (!requests || requests.length === 0) return null

  async function resolve(id: string, action: 'approve' | 'reject') {
    let rejection_reason = ''
    if (action === 'reject') {
      rejection_reason = window.prompt('Optional reason for rejection:') || ''
    }
    setBusy(id)
    const res = await fetch('/api/profile-claim/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: id, action, rejection_reason }),
    })
    setBusy(null)
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Action failed')
    }
  }

  return (
    <Card className="border-blue-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck size={18} className="text-blue-400" />
          Pending Claim Requests
          <Badge variant="default" className="bg-blue-500/20 text-blue-300 border-blue-500/40">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-800 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {r.members?.player_name}
                  {r.members?.game_id && <span className="text-slate-400 text-xs ml-2">ID: {r.members.game_id}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Requested by:{' '}
                  <span className="text-slate-300">{r.requester?.display_name || r.requester?.email || 'Unknown user'}</span>
                  {' · '}{new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => resolve(r.id, 'approve')} disabled={busy === r.id}>
                  <Check size={14} className="mr-1" />Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => resolve(r.id, 'reject')} disabled={busy === r.id}>
                  <X size={14} className="mr-1" />Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
