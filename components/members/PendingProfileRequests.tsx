// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus, Check, X } from 'lucide-react'

export function PendingProfileRequests({ requests }: { requests: any[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  if (!requests || requests.length === 0) return null

  async function resolve(id: string, action: 'approve' | 'reject') {
    let rejection_reason = ''
    if (action === 'reject') {
      rejection_reason = window.prompt('Optional reason for rejection:') || ''
    }
    setBusy(id)
    const res = await fetch('/api/approvals/profile-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: id, action, rejection_reason }),
    })
    setBusy(null)
    if (res.ok) router.refresh()
    else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Action failed')
    }
  }

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus size={18} className="text-amber-500" />
          Pending Profile Requests
          <Badge variant="amber">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-800 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.governor_name}
                  {r.player_id && <span className="text-slate-400 text-xs ml-2">ID: {r.player_id}</span>}
                </p>
                <p className="text-xs text-slate-400">Requested rank: <span className="text-amber-400">{r.requested_role?.toUpperCase()}</span> · {new Date(r.created_at).toLocaleDateString()}</p>
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
