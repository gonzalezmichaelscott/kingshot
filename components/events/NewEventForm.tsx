// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

interface Props {
  allianceId: string
  eventTypes: { id: string; name: string; slug: string }[]
}

export function NewEventForm({ allianceId, eventTypes }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    event_type_id: eventTypes[0]?.id || '',
    name: '',
    battle_start_utc: '',
    battle_end_utc: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: event, error: err } = await supabase.from('events').insert({
      alliance_id: allianceId,
      event_type_id: form.event_type_id,
      name: form.name || null,
      battle_start_utc: form.battle_start_utc || null,
      battle_end_utc: form.battle_end_utc || null,
      notes: form.notes || null,
      created_by: user?.id,
      status: 'planning',
    }).select().single()

    setLoading(false)
    if (err) { setError(err.message); return }
    router.push(`/alliances/${allianceId}/events/${event.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-slate-400 block mb-1">Event Type</label>
        <select
          required
          value={form.event_type_id}
          onChange={e => setForm(f => ({ ...f, event_type_id: e.target.value }))}
          className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {eventTypes.map(et => (
            <option key={et.id} value={et.id}>{et.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm text-slate-400 block mb-1">Event Name (optional)</label>
        <Input placeholder="Leave blank to use event type name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-slate-400 block mb-1">Battle Start (UTC)</label>
          <Input type="datetime-local" value={form.battle_start_utc} onChange={e => setForm(f => ({ ...f, battle_start_utc: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Battle End (UTC)</label>
          <Input type="datetime-local" value={form.battle_end_utc} onChange={e => setForm(f => ({ ...f, battle_end_utc: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="text-sm text-slate-400 block mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          placeholder="Event notes, special instructions..."
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Creating...' : 'Create Event'}
      </Button>
    </form>
  )
}
