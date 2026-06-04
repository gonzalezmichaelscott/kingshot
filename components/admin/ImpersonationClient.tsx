// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, RotateCcw, Ban, XCircle, ExternalLink, Loader2 } from 'lucide-react'

const STATUS_LABEL: Record<string, { text: string; variant: string }> = {
  pending: { text: 'Pending', variant: 'amber' },
  investigating: { text: 'Investigating', variant: 'blue' },
  resolved_restored: { text: 'Restored', variant: 'green' },
  resolved_dismissed: { text: 'Dismissed', variant: 'default' },
}

export function ImpersonationClient({ reports }: { reports: any[] }) {
  if (!reports || reports.length === 0) {
    return <Card><CardContent className="py-10 text-center text-slate-400 text-sm">No impersonation reports.</CardContent></Card>
  }
  return (
    <div className="space-y-4">
      {reports.map(r => <ReportCard key={r.id} report={r} />)}
    </div>
  )
}

function ReportCard({ report: r }: { report: any }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState<any>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const resolved = r.status === 'resolved_restored' || r.status === 'resolved_dismissed'
  const s = STATUS_LABEL[r.status] || STATUS_LABEL.pending

  async function act(action: string, opts: any = {}) {
    setError('')
    if (action === 'dismiss' && !note.trim()) { setError('An admin note is required to dismiss.'); return }
    if (action === 'restore' && !confirm('Restore this profile? It will be unlinked from the current account and made claimable again.')) return
    if (action === 'blacklist' && !confirm('Blacklist the current account holder? They will be signed out and unable to log back in.')) return
    setBusy(action)
    try {
      const res = await fetch('/api/admin/impersonation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: r.id, action, admin_note: note, ...opts }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Action failed'); return }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setBusy(null)
    }
  }

  async function lookupPlayer() {
    setLookingUp(true)
    try {
      const res = await fetch(`/api/player-lookup?playerId=${encodeURIComponent(r.claimed_player_id)}`)
      const d = res.ok ? await res.json() : null
      setLookup(d?.data || { error: 'Not found' })
    } catch {
      setLookup({ error: 'Lookup failed' })
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <Card className={r.status === 'pending' ? 'border-amber-500/40' : ''}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant={s.variant as any}>{s.text}</Badge>
            <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <p><span className="text-slate-400">Reporter email:</span> <span className="font-medium break-all">{r.reporter_email}</span></p>
          <p><span className="text-slate-400">Claimed Player ID:</span> <span className="font-medium">{r.claimed_player_id}</span></p>
          {r.claimed_player_name && <p><span className="text-slate-400">Governor:</span> <span className="font-medium">{r.claimed_player_name}</span></p>}
          <p><span className="text-slate-400">Current holder:</span> <span className="font-medium break-all">{r.holderEmail || (r.member ? 'Unlinked' : 'Unknown')}</span></p>
        </div>

        <div className="bg-slate-800/60 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">{r.description}</div>

        {/* Lookup + view profile */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={lookupPlayer} disabled={lookingUp}>
            {lookingUp ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Search size={14} className="mr-1" />}
            Look up Player ID
          </Button>
          {r.member?.alliance_id && (
            <Link href={`/alliances/${r.member.alliance_id}/members/${r.member.id}`} target="_blank">
              <Button size="sm" variant="secondary"><ExternalLink size={14} className="mr-1" />View Claimed Profile</Button>
            </Link>
          )}
        </div>

        {lookup && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3 text-sm">
            {lookup.error ? (
              <span className="text-red-400">{lookup.error}</span>
            ) : (
              <>
                {lookup.profilePhoto && <img src={lookup.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover" />}
                <div>
                  <p className="font-medium">{lookup.name}</p>
                  <p className="text-xs text-slate-400">Kingdom {lookup.kingdom} · Lv {lookup.level}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Admin notes */}
        {r.admin_notes && (
          <div className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-950/50 border border-slate-800 rounded-lg p-2">
            {r.admin_notes}
          </div>
        )}

        {!resolved && (
          <>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Admin note (private) — required to dismiss"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => act('investigating')} disabled={!!busy}>
                {busy === 'investigating' ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}Mark Investigating
              </Button>
              <Button size="sm" onClick={() => act('restore')} disabled={!!busy || !r.member}>
                <RotateCcw size={14} className="mr-1" />Restore Profile
              </Button>
              <Button size="sm" variant="secondary" className="text-red-300 hover:text-red-200" onClick={() => act('blacklist', { blacklist_user_id: true })} disabled={!!busy || !r.holderEmail}>
                <Ban size={14} className="mr-1" />Blacklist Account
              </Button>
              <Button size="sm" variant="ghost" onClick={() => act('dismiss')} disabled={!!busy}>
                <XCircle size={14} className="mr-1" />Dismiss
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
