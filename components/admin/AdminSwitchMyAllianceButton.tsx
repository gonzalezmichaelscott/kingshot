// @ts-nocheck
'use client'
/**
 * FIX 6 — System Admin only: switch MY OWN alliance directly from the dashboard,
 * with no leave/rejoin/approval flow. Kingdom dropdown → alliance dropdown →
 * "Switch My Alliance".
 */
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  currentAllianceId?: string | null
}

export function AdminSwitchMyAllianceButton({ currentAllianceId = null }: Props) {
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [kingdoms, setKingdoms] = useState<any[]>([])
  const [alliances, setAlliances] = useState<any[]>([])
  const [kingdomId, setKingdomId] = useState('')
  const [allianceId, setAllianceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('kingdoms')
        .select('id, name, server_number')
        .order('server_number')
      if (!cancelled) setKingdoms(data || [])
    })()
    return () => { cancelled = true }
  }, [open, supabase])

  useEffect(() => {
    setAllianceId('')
    if (!kingdomId) { setAlliances([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('alliances')
        .select('id, name, tag')
        .eq('kingdom_id', kingdomId)
        .order('name')
      if (!cancelled) setAlliances(data || [])
    })()
    return () => { cancelled = true }
  }, [kingdomId, supabase])

  async function switchAlliance() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/switch-my-alliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_alliance_id: allianceId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed to switch alliance')
      setSuccess(`Switched to ${d.alliance_name} successfully`)
      // Hard reload so all server-rendered permissions/context pick up the change.
      setTimeout(() => { window.location.href = '/dashboard' }, 1400)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-purple-300 hover:text-purple-200 font-medium"
      >
        <ShieldCheck size={15} /> Admin: Switch My Alliance
      </button>
    )
  }

  return (
    <div className="bg-purple-950/30 border border-purple-700/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-purple-300" />
        <h3 className="font-semibold text-purple-200">Admin: Switch My Alliance</h3>
      </div>
      <p className="text-xs text-slate-400">
        Move your own account to any alliance directly — no approval or leave/rejoin flow.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Kingdom</label>
          <select
            value={kingdomId}
            onChange={e => setKingdomId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select kingdom…</option>
            {kingdoms.map(k => (
              <option key={k.id} value={k.id}>
                {k.name}{k.server_number ? ` #${k.server_number}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Alliance</label>
          <select
            value={allianceId}
            onChange={e => setAllianceId(e.target.value)}
            disabled={!kingdomId}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select alliance…</option>
            {alliances.map(a => (
              <option key={a.id} value={a.id} disabled={a.id === currentAllianceId}>
                [{a.tag}] {a.name}{a.id === currentAllianceId ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && (
        <p className="text-green-400 text-sm flex items-center gap-1.5">
          <CheckCircle2 size={15} /> {success}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={switchAlliance}
          disabled={loading || !allianceId || allianceId === currentAllianceId}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? <><Loader2 size={15} className="animate-spin mr-1.5" />Switching…</> : 'Switch My Alliance'}
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setError('') }} disabled={loading}>Cancel</Button>
      </div>
    </div>
  )
}
