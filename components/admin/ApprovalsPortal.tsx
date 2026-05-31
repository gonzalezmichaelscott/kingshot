// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Crown, Shield, ShieldCheck, Check, X } from 'lucide-react'

function useResolver(endpoint: string) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function resolve(payload: any) {
    setBusy(payload.request_id)
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setBusy(null)
    if (res.ok) router.refresh()
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Action failed') }
  }
  return { busy, resolve }
}

function KingdomRequestCard({ req, showKingdom }: { req: any; showKingdom: boolean }) {
  const { busy, resolve } = useResolver('/api/approvals/kingdom-request')
  const [override, setOverride] = useState(req.requested_role)
  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <p className="font-medium">{req.governor_name} <span className="text-slate-400 text-xs">(ID: {req.player_id})</span></p>
          {showKingdom && <p className="text-slate-400 text-xs">Kingdom #{req.kingdom_number} — {req.kingdom_name}</p>}
          <p className="text-slate-300 text-xs mt-0.5">Alliance: {req.alliance_name} <span className="text-amber-400">[{req.alliance_tag}]</span></p>
          <p className="text-slate-500 text-xs">Requested rank: {req.requested_role?.toUpperCase()} · {new Date(req.created_at).toLocaleDateString()}</p>
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
        <Button size="sm" onClick={() => resolve({ request_id: req.id, action: 'approve', admin_role_override: override })} disabled={busy === req.id}>
          <Check size={14} className="mr-1" />Approve
        </Button>
        <Button size="sm" variant="ghost" onClick={() => resolve({ request_id: req.id, action: 'reject', rejection_reason: window.prompt('Rejection reason (optional):') || '' })} disabled={busy === req.id}>
          <X size={14} className="mr-1" />Reject
        </Button>
      </div>
    </div>
  )
}

function RankRequestCard({ req }: { req: any }) {
  const { busy, resolve } = useResolver('/api/approvals/profile-request')
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
      <div className="text-sm">
        <p className="font-medium">{req.governor_name} {req.player_id && <span className="text-slate-400 text-xs">(ID: {req.player_id})</span>}</p>
        <p className="text-slate-400 text-xs">Alliance: {req.alliances ? `[${req.alliances.tag}] ${req.alliances.name}` : '—'}</p>
        <p className="text-slate-500 text-xs">Current: {req.current_role ? req.current_role.toUpperCase() : 'none'} → Requested: <span className="text-amber-400">{req.requested_role?.toUpperCase()}</span></p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => resolve({ request_id: req.id, action: 'approve', assigned_role: req.requested_role })} disabled={busy === req.id}>
          <Check size={14} className="mr-1" />Approve
        </Button>
        <Button size="sm" variant="ghost" onClick={() => resolve({ request_id: req.id, action: 'reject', rejection_reason: window.prompt('Rejection reason (optional):') || '' })} disabled={busy === req.id}>
          <X size={14} className="mr-1" />Reject
        </Button>
      </div>
    </div>
  )
}

export function ApprovalsPortal({ kingdomRequests, allianceRequests, rankRequests }: { kingdomRequests: any[]; allianceRequests: any[]; rankRequests: any[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Crown size={18} className="text-amber-500" />New Kingdom / Alliance Requests {kingdomRequests.length > 0 && <Badge variant="amber">{kingdomRequests.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {kingdomRequests.length === 0 ? <p className="text-slate-400 text-sm">No pending new-kingdom requests.</p>
            : kingdomRequests.map(r => <KingdomRequestCard key={r.id} req={r} showKingdom />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield size={18} className="text-amber-500" />New Alliance Requests {allianceRequests.length > 0 && <Badge variant="amber">{allianceRequests.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {allianceRequests.length === 0 ? <p className="text-slate-400 text-sm">No pending new-alliance requests.</p>
            : allianceRequests.map(r => <KingdomRequestCard key={r.id} req={r} showKingdom={false} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck size={18} className="text-amber-500" />R4 / R5 Rank Requests {rankRequests.length > 0 && <Badge variant="amber">{rankRequests.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rankRequests.length === 0 ? <p className="text-slate-400 text-sm">No pending rank requests.</p>
            : rankRequests.map(r => <RankRequestCard key={r.id} req={r} />)}
        </CardContent>
      </Card>
    </div>
  )
}
