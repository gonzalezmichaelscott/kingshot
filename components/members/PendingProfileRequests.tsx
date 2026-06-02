// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus, Check, X } from 'lucide-react'
import { roleLabel } from '@/lib/access'

export function PendingProfileRequests({ requests, allianceId, currentUserId }: { requests: any[]; allianceId?: string; currentUserId?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>(requests || [])
  const [toast, setToast] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  // Re-sync when the server re-renders the list.
  useEffect(() => { setItems(requests || []) }, [requests])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  // Realtime — broadcast to all eligible approvers; first to resolve wins and the
  // request disappears from everyone else's queue (Feature 2).
  useEffect(() => {
    if (!allianceId) return
    const channel = supabase
      .channel(`pending-reqs:${allianceId}:${currentUserId || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profile_requests', filter: `alliance_id=eq.${allianceId}` },
        async (payload) => {
          const row: any = payload.new || payload.old
          if (!row) return
          if (payload.eventType === 'INSERT') { if (row.status === 'pending') router.refresh(); return }
          if (payload.eventType === 'DELETE' || row.status !== 'pending') {
            setItems(prev => prev.filter(r => r.id !== row.id))
            if (row.reviewed_by && row.reviewed_by !== currentUserId) {
              let name = 'another approver'
              const { data: rp } = await supabase
                .from('user_profiles').select('display_name').eq('id', row.reviewed_by).maybeSingle()
              if (rp?.display_name) name = rp.display_name
              showToast(`Request ${row.status === 'approved' ? 'approved' : 'rejected'} by ${name}`)
            }
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [allianceId, currentUserId, supabase, router])

  if (!items || items.length === 0) {
    return toast ? <Toast msg={toast} /> : null
  }

  async function resolve(id: string, action: 'approve' | 'reject') {
    let rejection_reason = ''
    if (action === 'reject') rejection_reason = window.prompt('Optional reason for rejection:') || ''
    setBusy(id)
    const res = await fetch('/api/approvals/profile-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: id, action, rejection_reason }),
    })
    setBusy(null)
    if (res.ok) { setItems(prev => prev.filter(r => r.id !== id)); router.refresh() }
    else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Action failed') }
  }

  return (
    <>
      <Card className="border-amber-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus size={18} className="text-amber-500" />
            Pending Requests
            <Badge variant="amber">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap bg-slate-800 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.governor_name}
                    {r.player_id && <span className="text-slate-400 text-xs ml-2">ID: {r.player_id}</span>}
                  </p>
                  <p className="text-xs text-slate-400">Requested rank: <span className="text-amber-400">{roleLabel(r.requested_role)}</span> · {new Date(r.created_at).toLocaleDateString()}</p>
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
      {toast && <Toast msg={toast} />}
    </>
  )
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-[120] bg-slate-900 border border-amber-500/40 text-slate-100 text-sm rounded-xl shadow-2xl px-4 py-3 max-w-xs">
      {msg}
    </div>
  )
}
