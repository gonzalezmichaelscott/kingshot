// @ts-nocheck
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UtcDateTimePicker } from '@/components/ui/UtcDateTimePicker'
import { ChevronLeft, ChevronRight, Plus, X, Edit2, Trash2, Repeat, Calendar as CalIcon } from 'lucide-react'
import {
  CalendarEvent, CALENDAR_COLORS, RECURRENCE_LABELS, occurrencesByDay, utcDayKey,
} from '@/lib/calendar'
import { formatUtcTime, toDatetimeLocalUtc, fromDatetimeLocalUtc } from '@/lib/utils'

interface Props {
  allianceId: string
  events: CalendarEvent[]
  canManage: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const COLOR_OPTIONS = ['amber', 'red', 'green', 'blue', 'purple']

function emptyForm(dayKey?: string) {
  return {
    id: null as string | null,
    title: '',
    description: '',
    event_date: dayKey ? `${dayKey}T12:00` : '',
    end_date: '',
    color: 'amber',
    is_recurring: false,
    recurrence_type: 'weekly',
    recurrence_interval_days: 7,
    recurrence_end_date: '',
  }
}

export function AllianceCalendar({ allianceId, events, canManage }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Month being viewed (UTC). Default to current UTC month.
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth())
  const [selectedDay, setSelectedDay] = useState<string | null>(utcDayKey(today))
  const [form, setForm] = useState<any>(null) // null = closed
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // First/last visible grid cells (full weeks covering the month).
  const monthStart = new Date(Date.UTC(viewYear, viewMonth, 1))
  const gridStart = new Date(monthStart)
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay())
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setUTCDate(gridStart.getUTCDate() + i)
    cells.push(d)
  }
  const gridEnd = cells[cells.length - 1]

  const byDay = useMemo(
    () => occurrencesByDay(events, gridStart, gridEnd),
    [events, gridStart.getTime(), gridEnd.getTime()],
  )

  const todayKey = utcDayKey(today)
  const selectedOccurrences = selectedDay ? (byDay[selectedDay] || []) : []

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }

  function openNew(dayKey: string) {
    setError('')
    setForm(emptyForm(dayKey))
  }

  function openEdit(ev: CalendarEvent) {
    setError('')
    setForm({
      id: ev.id,
      title: ev.title,
      description: ev.description || '',
      event_date: toDatetimeLocalUtc(ev.event_date),
      end_date: toDatetimeLocalUtc(ev.end_date),
      color: ev.color || 'amber',
      is_recurring: !!ev.is_recurring,
      recurrence_type: ev.recurrence_type || 'weekly',
      recurrence_interval_days: ev.recurrence_interval_days || 7,
      recurrence_end_date: toDatetimeLocalUtc(ev.recurrence_end_date),
    })
  }

  async function save() {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.event_date) { setError('Date and time are required.'); return }
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload: any = {
      alliance_id: allianceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: fromDatetimeLocalUtc(form.event_date),
      end_date: fromDatetimeLocalUtc(form.end_date),
      color: form.color,
      is_recurring: form.is_recurring,
      recurrence_type: form.is_recurring ? form.recurrence_type : null,
      recurrence_interval_days: form.is_recurring && form.recurrence_type === 'custom'
        ? Number(form.recurrence_interval_days) || null : null,
      recurrence_end_date: form.is_recurring ? fromDatetimeLocalUtc(form.recurrence_end_date) : null,
    }
    let err
    if (form.id) {
      ;({ error: err } = await supabase.from('alliance_calendar_events').update(payload).eq('id', form.id))
    } else {
      payload.created_by = user?.id
      ;({ error: err } = await supabase.from('alliance_calendar_events').insert(payload))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(null)
    router.refresh()
  }

  async function remove(ev: CalendarEvent) {
    if (!confirm(`Delete "${ev.title}"? This removes all of its occurrences.`)) return
    const { error: err } = await supabase.from('alliance_calendar_events').delete().eq('id', ev.id)
    if (err) { alert(err.message); return }
    router.refresh()
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Calendar grid */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="Previous month">
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-bold">{MONTHS[viewMonth]} {viewYear} <span className="text-xs font-normal text-slate-500">UTC</span></h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-300" title="Next month">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-medium text-slate-500 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map(cell => {
                const key = utcDayKey(cell)
                const inMonth = cell.getUTCMonth() === viewMonth
                const occs = byDay[key] || []
                const isToday = key === todayKey
                const isSelected = key === selectedDay
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    onDoubleClick={() => canManage && openNew(key)}
                    className={`min-h-[58px] sm:min-h-[68px] rounded-lg border p-1.5 text-left flex flex-col transition-colors ${
                      isSelected ? 'border-amber-500 bg-amber-500/10'
                        : inMonth ? 'border-slate-800 bg-slate-900 hover:bg-slate-800'
                        : 'border-slate-900 bg-slate-950/50 text-slate-600'
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-amber-400' : inMonth ? 'text-slate-300' : 'text-slate-600'}`}>
                      {cell.getUTCDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {occs.slice(0, 4).map((o, i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${CALENDAR_COLORS[o.event.color]?.dot || CALENDAR_COLORS.amber.dot}`} />
                      ))}
                      {occs.length > 4 && <span className="text-[9px] text-slate-500">+{occs.length - 4}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            {canManage && (
              <p className="text-[11px] text-slate-500 mt-3">Tip: double-click a day to add an event, or use the button in the side panel.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side panel — events for the selected day */}
      <div>
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <CalIcon size={16} className="text-amber-500" />
                {selectedDay ? new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Select a day'}
              </h3>
              {canManage && selectedDay && (
                <button onClick={() => openNew(selectedDay)} className="text-amber-400 hover:text-amber-300" title="Add event">
                  <Plus size={18} />
                </button>
              )}
            </div>

            {selectedOccurrences.length === 0 && (
              <p className="text-sm text-slate-400">No events on this day.</p>
            )}

            {selectedOccurrences.map((o, i) => {
              const ev = o.event
              const c = CALENDAR_COLORS[ev.color] || CALENDAR_COLORS.amber
              return (
                <div key={ev.id + i} className={`rounded-lg border p-3 ${c.badge}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100 break-words">{ev.title}</p>
                      <p className="text-xs text-slate-300/80 mt-0.5">
                        {formatUtcTime(ev.event_date)}
                        {ev.end_date && <> – {formatUtcTime(ev.end_date)}</>}
                      </p>
                      {ev.is_recurring && (
                        <p className="text-[11px] text-slate-300/70 mt-1 flex items-center gap-1">
                          <Repeat size={11} />
                          {RECURRENCE_LABELS[ev.recurrence_type] || 'Recurring'}
                          {ev.recurrence_type === 'custom' && ev.recurrence_interval_days ? ` (every ${ev.recurrence_interval_days}d)` : ''}
                        </p>
                      )}
                      {ev.description && <p className="text-xs text-slate-300/80 mt-1.5 whitespace-pre-wrap">{ev.description}</p>}
                    </div>
                    {canManage && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(ev)} className="text-slate-300 hover:text-amber-300" title="Edit"><Edit2 size={14} /></button>
                        <button onClick={() => remove(ev)} className="text-slate-300 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Event form modal */}
      {form && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800">
              <h2 className="font-semibold">{form.id ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-100 p-1"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title <span className="text-red-400">*</span></label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. KVK Castle Rotation — [Alliance] gets Castle" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description <span className="text-slate-500">(optional)</span></label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                <div className="min-w-0">
                  <label className="text-xs text-slate-400 block mb-1">Date & Time (UTC) <span className="text-red-400">*</span></label>
                  <UtcDateTimePicker value={form.event_date} onChange={v => setForm(f => ({ ...f, event_date: v }))} />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-slate-400 block mb-1">End (UTC) <span className="text-slate-500">(optional)</span></label>
                  <UtcDateTimePicker value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Color label</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full ${CALENDAR_COLORS[c].dot} ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-slate-900 ' + CALENDAR_COLORS[c].ring : 'opacity-60'}`}
                      title={c} />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} className="accent-amber-500" />
                <span className="text-sm text-slate-300 flex items-center gap-1"><Repeat size={13} /> Recurring event</span>
              </label>
              {form.is_recurring && (
                <div className="space-y-3 bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Recurrence</label>
                    <select value={form.recurrence_type} onChange={e => setForm(f => ({ ...f, recurrence_type: e.target.value }))}
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom interval (days)</option>
                    </select>
                  </div>
                  {form.recurrence_type === 'custom' && (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Repeat every N days</label>
                      <Input type="number" min={1} value={form.recurrence_interval_days}
                        onChange={e => setForm(f => ({ ...f, recurrence_interval_days: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Recurrence end (UTC) <span className="text-slate-500">(optional)</span></label>
                    <UtcDateTimePicker value={form.recurrence_end_date} onChange={v => setForm(f => ({ ...f, recurrence_end_date: v }))} />
                  </div>
                </div>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Event'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
