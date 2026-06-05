// @ts-nocheck
'use client'
/**
 * FIX 6 — System Admin only: directly move a member to any kingdom/alliance with
 * no approval flow. Renders a kingdom dropdown, an alliance dropdown (populated
 * from the chosen kingdom), and a "Move Member" button.
 */
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  memberId: string
  playerName: string
  currentAllianceId: string
}

export function AdminMoveMemberButton({ memberId, playerName, currentAllianceId }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [kingdoms, setKingdoms] = useState<any[]>([])
  const [alliances, setAlliances] = useState<any[]>([])
  const [kingdomId, setKingdomId] = useState('')
  const [allianceId, setAllianceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Load all kingdoms once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('kingdoms')
        .select('id, name, server_number')
        .order('server_number')
      if (!cancelled) setKingdoms(data || [])
    })()
    return () => { cancelled = true }
  }, [supabase])

  // Load alliances for the selected kingdom.
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

  async function move() {
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/admin/move-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, target_alliance_id: allianceId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Failed to move member')
      setSuccess(`Member moved to ${d.alliance_name} successfully`)
      setTimeout(() => router.refresh(), 1400)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-purple-950/30 border border-purple-700/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-purple-300" />
        <h3 className="font-semibold text-purple-200">Admin: Move to Alliance</h3>
      </div>
      <p className="text-xs text-slate-400">
        Move <span className="text-slate-200">{playerName}</span> to any kingdom/alliance directly. No approval required;
        the member record is not deactivated and no rejoin flow is triggered.
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

      <Button
        onClick={move}
        disabled={loading || !allianceId || allianceId === currentAllianceId}
        className="bg-purple-600 hover:bg-purple-700"
      >
        {loading ? <><Loader2 size={15} className="animate-spin mr-1.5" />Moving…</> : 'Move Member'}
      </Button>
    </div>
  )
}
