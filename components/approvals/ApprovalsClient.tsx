// @ts-nocheck
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { UserPlus, ShieldCheck, Crown, Check, X, AlertTriangle, History } from 'lucide-react'
import { roleLabel } from '@/lib/access'

function timeAgo(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props {
  role: string
  userId: string
  joinRequests: any[]
  leadershipRequests: any[]
  kingdomRequests: any[]
  allianceRequests: any[]
}

export function ApprovalsClient({
  role, userId,
  joinRequests, leadershipRequests, kingdomRequests, allianceRequests,
}: Props) {
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const [joins, setJoins] = useState(joinRequests)
  const [leads, setLeads] = useState(leadershipRequests)
  const [kingdoms, setKingdoms] = useState(kingdomRequests)
  const [alliances, setAlliances] = useState(allianceRequests)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Re-sync from the server whenever it re-renders (new request arrived, etc.)
  useEffect(() => { setJoins(joinRequests) }, [joinRequests])
  useEffect(() => { setLeads(leadershipRequests) }, [leadershipRequests])
  useEffect(() => { setKingdoms(kingdomRequests) }, [kingdomRequests])
  useEffect(() => { setAlliances(allianceRequests) }, [allianceRequests])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  const removeProfileReq = useCallback((id: string) => {
    setJoins(prev => prev.filter(r => r.id !== id))
    setLeads(prev => prev.filter(r => r.id !== id))
  }, [])

  // Realtime: first approver to resolve wins; the row disappears for everyone else.
  useEffect(() => {
    const channel = supabase
      .channel(`approvals:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_requests' }, async (payload) => {
        const row: any = payload.new || payload.old
        if (!row) return
        if (payload.eventType === 'INSERT') {
          if (row.status === 'pending') router.refresh()
          return
        }
        // UPDATE/DELETE — if no longer pending, drop it from this viewer's queues.
        if (payload.eventType === 'DELETE' || row.status !== 'pending') {
          removeProfileReq(row.id)
          if (row.reviewed_by && row.reviewed_by !== userId) {
            let name = 'another approver'
            // Prefer the reviewer's in-game tag; never surface their real auth name (Fix 4).
            const { data: rm } = await supabase
              .from('members').select('player_name').eq('linked_user_id', row.reviewed_by).maybeSingle()
            if (rm?.player_name) {
              name = rm.player_name
            } else {
              const { data: rp } = await supabase
                .from('user_profiles').select('display_name').eq('id', row.reviewed_by).maybeSingle()
              if (rp?.display_name) name = rp.display_name
            }
            const verb = row.status === 'approved' ? 'approved' : 'rejected'
            showToast(`Request ${verb} by ${name}`)
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kingdom_creation_requests' }, (payload) => {
        const row: any = payload.new || payload.old
        if (!row) return
        if (payload.eventType === 'INSERT') { router.refresh(); return }
        if (payload.eventType === 'DELETE' || row.status !== 'pending') {
          setKingdoms(prev => prev.filter(r => r.id !== row.id))
          setAlliances(prev => prev.filter(r => r.id !== row.id))
          if (row.reviewed_by && row.reviewed_by !== userId) showToast('A creation request was resolved by another admin')
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase, router, removeProfileReq])

  async function resolveProfile(payload: any) {
    setBusy(payload.request_id)
    const res = await fetch('/api/approvals/profile-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setBusy(null)
    if (res.ok) { removeProfileReq(payload.request_id); router.refresh() }
    else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Action failed') }
  }

  async function resolveKingdom(payload: any) {
    setBusy(payload.request_id)
    const res = await fetch('/api/approvals/kingdom-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setBusy(null)
    if (res.ok) {
      setKingdoms(prev => prev.filter(r => r.id !== payload.request_id))
      setAlliances(prev => prev.filter(r => r.id !== payload.request_id))
      router.refresh()
    } else { const d = await res.json().catch(() => ({})); showToast(d.error || 'Action failed') }
  }

  const totalCount = joins.length + leads.length + kingdoms.length + alliances.length
  const isAdmin = role === 'system_admin'

  return (
    <div className="space-y-6">
      {totalCount === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No pending approvals — you&apos;re all caught up ✓</p>
          </CardContent>
        </Card>
      )}

      {/* Section 1 — Join Requests */}
      {(role === 'r4' || role === 'r5') && joins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus size={18} className="text-amber-500" /> Join Requests
              <Badge variant="amber">{joins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {joins.map(r => (
              <ProfileCard key={r.id} req={r} busy={busy} onResolve={resolveProfile} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 2 — Leadership Requests */}
      {(role === 'r5' || isAdmin) && leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck size={18} className="text-amber-500" /> Leadership Requests (R4 / R5)
              <Badge variant="amber">{leads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leads.map(r => (
              <ProfileCard key={r.id} req={r} busy={busy} onResolve={resolveProfile} leadership />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 3 — Kingdom / Alliance Creation (admin only) */}
      {isAdmin && (kingdoms.length > 0 || alliances.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown size={18} className="text-amber-500" /> Kingdom / Alliance Creation
              <Badge variant="amber">{kingdoms.length + alliances.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kingdoms.map(r => <KingdomCard key={r.id} req={r} busy={busy} onResolve={resolveKingdom} showKingdom />)}
            {alliances.map(r => <KingdomCard key={r.id} req={r} busy={busy} onResolve={resolveKingdom} showKingdom={false} />)}
          </CardContent>
        </Card>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[120] bg-slate-900 border border-amber-500/40 text-slate-100 text-sm rounded-xl shadow-2xl px-4 py-3 max-w-xs">
          {toast}
        </div>
      )}
    </div>
  )
}

function RejectBox({ onReject, busy }: { onReject: (reason: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={busy}>
        <X size={14} className="mr-1" />Reject
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Optional reason…"
        className="h-9 px-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <Button size="sm" variant="ghost" onClick={() => onReject(reason)} disabled={busy}>Confirm reject</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  )
}

function ProfileCard({ req, busy, onResolve, leadership }: any) {
  const [override, setOverride] = useState(req.requested_role)
  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerAvatar gameId={req.player_id} playerName={req.governor_name} sizeClass="w-9 h-9" />
          <div className="text-sm min-w-0">
            <p className="font-medium">{req.governor_name}
              {req.player_id && <span className="text-slate-400 text-xs ml-2">ID: {req.player_id}</span>}
            </p>
            <p className="text-slate-400 text-xs">
              {req.alliances ? `[${req.alliances.tag}] ${req.alliances.name}` : '—'}
            </p>
            <p className="text-slate-500 text-xs">
              {req.current_role ? `Current: ${roleLabel(req.current_role)} → ` : ''}
              Requested: <span className="text-amber-400">{roleLabel(req.requested_role)}</span>
              {req.created_at ? ` · ${timeAgo(req.created_at)}` : ''}
            </p>
          </div>
        </div>
        <Badge variant="amber">{roleLabel(req.requested_role)}</Badge>
      </div>

      {leadership && (
        <p className="flex items-center gap-1.5 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5">
          <AlertTriangle size={12} /> Leadership rank — verify in-game before approving
        </p>
      )}

      {req.has_existing_profile && (
        <p className="flex items-center gap-1.5 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5">
          <History size={12} className="flex-shrink-0" />
          This player has an existing profile with stats. Approving will transfer their data to your alliance.
        </p>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        {leadership && (
          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Approve as</label>
            <select value={override} onChange={e => setOverride(e.target.value)}
              className="h-9 px-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="r4">R4</option>
              <option value="r5">R5</option>
            </select>
          </div>
        )}
        <Button size="sm" disabled={busy === req.id}
          onClick={() => onResolve({ request_id: req.id, action: 'approve', assigned_role: leadership ? override : req.requested_role })}>
          <Check size={14} className="mr-1" />Approve
        </Button>
        <RejectBox busy={busy === req.id}
          onReject={(reason) => onResolve({ request_id: req.id, action: 'reject', rejection_reason: reason })} />
      </div>
    </div>
  )
}

function KingdomCard({ req, busy, onResolve, showKingdom }: any) {
  const [override, setOverride] = useState(req.requested_role)
  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <p className="font-medium">{req.governor_name} <span className="text-slate-400 text-xs">(ID: {req.player_id})</span></p>
          {showKingdom && <p className="text-slate-400 text-xs">Kingdom #{req.kingdom_number} — {req.kingdom_name}</p>}
          <p className="text-slate-300 text-xs mt-0.5">Alliance: {req.alliance_name} <span className="text-amber-400">[{req.alliance_tag}]</span></p>
          <p className="text-slate-500 text-xs">Requested: {roleLabel(req.requested_role)} · {timeAgo(req.created_at)}</p>
        </div>
        <Badge variant="amber">{showKingdom ? 'New Kingdom' : 'New Alliance'}</Badge>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-[11px] text-slate-400 block mb-0.5">Assign role</label>
          <select value={override} onChange={e => setOverride(e.target.value)}
            className="h-9 px-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="r4">R4</option>
            <option value="r5">R5</option>
          </select>
        </div>
        <Button size="sm" disabled={busy === req.id}
          onClick={() => onResolve({ request_id: req.id, action: 'approve', admin_role_override: override })}>
          <Check size={14} className="mr-1" />Approve
        </Button>
        <RejectBox busy={busy === req.id}
          onReject={(reason) => onResolve({ request_id: req.id, action: 'reject', rejection_reason: reason })} />
      </div>
    </div>
  )
}
