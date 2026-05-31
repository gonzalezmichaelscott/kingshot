// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'

const TROOP_TYPES = ['infantry', 'cavalry', 'archer', 'mixed'] as const
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo',
  'Asia/Seoul', 'Australia/Sydney',
]

interface Props { member: any }

export function MemberEditForm({ member }: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    player_name: member.player_name || '',
    game_id: member.game_id || '',
    power: member.power || '',
    troop_count: member.troop_count || '',
    march_size: member.march_size || '',
    rally_capacity: member.rally_capacity || '',
    timezone: member.timezone || 'UTC',
    notes: member.notes || '',
  })
  const router = useRouter()

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/member/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: member.access_token,
        player_name: form.player_name,
        game_id: form.game_id,
        power: parseInt(String(form.power)) || 0,
        troop_count: parseInt(String(form.troop_count)) || 0,
        march_size: parseInt(String(form.march_size)) || 0,
        rally_capacity: parseInt(String(form.rally_capacity)) || 0,
        timezone: form.timezone,
        notes: form.notes,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Save failed')
      return
    }
    setOpen(false)
    // Re-fetch fresh data from the database rather than trusting local state
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit2 size={16} className="text-amber-500" />
            Member Details
          </CardTitle>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-sm text-amber-500 hover:text-amber-400"
          >
            {open ? <><ChevronUp size={16} />Collapse</> : <><ChevronDown size={16} />Edit</>}
          </button>
        </div>
      </CardHeader>

      {/* Read-only summary */}
      {!open && (
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Power', value: member.power?.toLocaleString() || '0' },
              { label: 'Troops', value: member.troop_count?.toLocaleString() || '0' },
              { label: 'March Size', value: member.march_size?.toLocaleString() || '0' },
              { label: 'Rally Cap', value: member.rally_capacity?.toLocaleString() || '0' },
              { label: 'Timezone', value: member.timezone || 'UTC' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-0.5">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {member.notes && (
            <p className="mt-3 text-sm text-slate-300 bg-slate-800 rounded-lg p-3 whitespace-pre-wrap">
              {member.notes}
            </p>
          )}
        </CardContent>
      )}

      {/* Edit form */}
      {open && (
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Player Name</label>
              <Input value={form.player_name} onChange={e => setForm(f => ({ ...f, player_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Game ID</label>
              <Input placeholder="Optional in-game ID" value={form.game_id} onChange={e => setForm(f => ({ ...f, game_id: e.target.value }))} />
            </div>
            {([
              { key: 'power', label: 'Power' },
              { key: 'troop_count', label: 'Troop Count' },
              { key: 'march_size', label: 'March Size' },
              { key: 'rally_capacity', label: 'Rally Capacity' },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form[key]}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9]/g, '')
                    setForm(f => ({ ...f, [key]: v === '' ? '' : parseInt(v) }))
                  }}
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Timezone</label>
              <select
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Officer notes about this member..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              <Save size={14} className="mr-1" />
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              <X size={14} className="mr-1" />
              Cancel
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
