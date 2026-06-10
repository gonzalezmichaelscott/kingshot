// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UtcDateTimePicker } from '@/components/ui/UtcDateTimePicker'
import { Edit2, X, Save, Trash2 } from 'lucide-react'

interface Props {
  event: any
  /** Compact icon button for list rows; full labelled button on detail pages. */
  compact?: boolean
}

// UTC wall-clock value for a datetime-local input (YYYY-MM-DDTHH:mm), or ''.
function toInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try { return new Date(iso).toISOString().slice(0, 16) } catch { return '' }
}

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'registration', label: 'Registration / Published' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export function EditEventButton({ event, compact }: Props) {
  const router = useRouter()
  const slug = event.event_types?.slug
  const isSwordland = slug === 'swordland_showdown'
  const isTriAlliance = slug === 'tri_alliance_clash'
  // Events that run two Legions with separate battle times (Swordland structure).
  const isTwoLegion = isSwordland || isTriAlliance
  const isKvk = slug === 'kvk_castle_battle'

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: event.name || '',
    battle_start_utc: toInput(event.battle_start_utc),
    battle_end_utc: toInput(event.battle_end_utc),
    legion1_start_utc: toInput(event.legion1_start_utc || event.battle_start_utc),
    legion2_start_utc: toInput(event.legion2_start_utc),
    status: event.status || 'planning',
    notes: event.notes || '',
  })

  function reset() {
    setForm({
      name: event.name || '',
      battle_start_utc: toInput(event.battle_start_utc),
      battle_end_utc: toInput(event.battle_end_utc),
      legion1_start_utc: toInput(event.legion1_start_utc || event.battle_start_utc),
      legion2_start_utc: toInput(event.legion2_start_utc),
      status: event.status || 'planning',
      notes: event.notes || '',
    })
    setConfirmDelete(false)
    setError('')
  }

  async function remove() {
    setDeleting(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: event.id }),
      })
    } catch {
      setDeleting(false)
      setError('Network error — the event was not deleted. Please try again.')
      return
    }
    setDeleting(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Delete failed')
      return
    }
    setOpen(false)
    // Works from both the list page and the event detail page (which no longer exists).
    router.push(`/alliances/${event.alliance_id}/events`)
    router.refresh()
  }

  async function save() {
    setSaving(true)
    setError('')

    if (isTwoLegion && (!form.legion1_start_utc || !form.legion2_start_utc)) {
      setError('Both Legion 1 and Legion 2 battle times are required.')
      setSaving(false)
      return
    }

    // Only send fields relevant to this event type.
    const payload: Record<string, any> = {
      event_id: event.id,
      name: form.name,
      status: form.status,
      notes: form.notes,
    }
    if (isTwoLegion) {
      payload.legion1_start_utc = form.legion1_start_utc
      payload.legion2_start_utc = form.legion2_start_utc
    } else {
      payload.battle_start_utc = form.battle_start_utc
      payload.battle_end_utc = form.battle_end_utc
    }

    const res = await fetch('/api/events/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed')
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); reset(); setOpen(true) }}
        title="Edit event"
        className={compact
          ? 'flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors'
          : 'flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors'}
      >
        <Edit2 size={compact ? 13 : 14} />
        {compact ? <span className="hidden sm:inline">Edit</span> : 'Edit Event'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[150] bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800">
              <h2 className="font-semibold">Edit Event</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-100 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Event Name {event.is_custom ? <span className="text-red-400">*</span> : <span className="text-slate-500">(optional)</span>}
                </label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Event name" />
              </div>

              {isTwoLegion ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                  <div className="min-w-0">
                    <label className="text-xs text-slate-400 block mb-1">Legion 1 Battle Time (UTC) <span className="text-red-400">*</span></label>
                    <UtcDateTimePicker value={form.legion1_start_utc} onChange={v => setForm(f => ({ ...f, legion1_start_utc: v }))} />
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs text-slate-400 block mb-1">Legion 2 Battle Time (UTC) <span className="text-red-400">*</span></label>
                    <UtcDateTimePicker value={form.legion2_start_utc} onChange={v => setForm(f => ({ ...f, legion2_start_utc: v }))} />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Battle Start (UTC)</label>
                    <UtcDateTimePicker value={form.battle_start_utc} onChange={v => setForm(f => ({ ...f, battle_start_utc: v }))} />
                    {isKvk && (
                      <p className="text-[11px] text-slate-500 mt-1">Castle battle window is 12:00–17:00 UTC on the chosen date.</p>
                    )}
                  </div>
                  {!isKvk && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Battle End (UTC) <span className="text-slate-500">(optional)</span></label>
                      <UtcDateTimePicker value={form.battle_end_utc} onChange={v => setForm(f => ({ ...f, battle_end_utc: v }))} />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Event notes…"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" onClick={save} disabled={saving || deleting}>
                  <Save size={14} className="mr-1" />
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <div className="ml-auto">
                  {confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-300">Delete permanently?</span>
                      <button
                        type="button"
                        onClick={remove}
                        disabled={deleting}
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <Trash2 size={13} />
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1 text-xs text-red-400/80 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={13} />
                      Delete Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
