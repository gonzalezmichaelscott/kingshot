// @ts-nocheck
'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor, parseMarkdownToHtml } from '@/components/ui/RichTextEditor'
import { UtcDateTimePicker } from '@/components/ui/UtcDateTimePicker'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

interface Props {
  allianceId: string
  eventTypes: { id: string; name: string; slug: string }[]
}

export function NewEventForm({ allianceId, eventTypes }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isCustom, setIsCustom] = useState(false)
  // Stable temp folder for image uploads before the event is saved
  const uploadFolderRef = useRef(`temp/${typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now()}`)

  // Standard event form
  const [form, setForm] = useState({
    event_type_id: eventTypes[0]?.id || '',
    name: '',
    battle_start_utc: '',
    battle_end_utc: '',
    legion1_start_utc: '',
    legion2_start_utc: '',
    notes: '',
  })

  const selectedType = eventTypes.find(et => et.id === form.event_type_id)
  const isSwordland = selectedType?.slug === 'swordland_showdown'

  // Custom event form
  const [customForm, setCustomForm] = useState({
    name: '',
    battle_start_utc: '',
    battle_end_utc: '',
    custom_instructions: '',
    visibility: 'all' as 'all' | 'r4_plus' | 'specific',
    status: 'planning' as 'planning' | 'registration',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStandardSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (isSwordland && (!form.legion1_start_utc || !form.legion2_start_utc)) {
      setError('Both Legion 1 and Legion 2 battle times are required for Swordland Showdown.')
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    // For Swordland, Legion 1 doubles as the canonical battle_start_utc (back-compat).
    const startUtc = isSwordland ? form.legion1_start_utc : form.battle_start_utc
    const { data: event, error: err } = await supabase.from('events').insert({
      alliance_id: allianceId,
      event_type_id: form.event_type_id,
      name: form.name || null,
      battle_start_utc: startUtc || null,
      battle_end_utc: form.battle_end_utc || null,
      legion1_start_utc: isSwordland ? form.legion1_start_utc : null,
      legion2_start_utc: isSwordland ? form.legion2_start_utc : null,
      notes: form.notes || null,
      created_by: user?.id,
      status: 'planning',
      is_custom: false,
    }).select().single()
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push(`/alliances/${allianceId}/events/${event.id}`)
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customForm.name.trim()) { setError('Event name is required.'); return }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const html = parseMarkdownToHtml(customForm.custom_instructions)
    const { data: event, error: err } = await supabase.from('events').insert({
      alliance_id: allianceId,
      event_type_id: null,
      name: customForm.name,
      battle_start_utc: customForm.battle_start_utc || null,
      battle_end_utc: customForm.battle_end_utc || null,
      notes: null,
      created_by: user?.id,
      status: customForm.status,
      is_custom: true,
      custom_instructions: customForm.custom_instructions || null,
      custom_instructions_html: html || null,
      visibility: customForm.visibility,
      custom_images: [],
    }).select().single()
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push(`/alliances/${allianceId}/events/${event.id}`)
  }

  return (
    <div className="space-y-5">
      {/* Toggle between standard and custom */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setIsCustom(false)}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
            !isCustom ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Standard Event
        </button>
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            isCustom ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles size={13} />
          Custom Event
        </button>
      </div>

      {/* Standard Event Form */}
      {!isCustom && (
        <form onSubmit={handleStandardSubmit} className="space-y-4">
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
          {isSwordland ? (
            <div className="space-y-3">
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-300">
                Swordland Showdown runs two Legions at different times (set by in-game vote). Enter both battle times — members will choose which Legion to join.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Legion 1 Battle Time (UTC) <span className="text-red-400">*</span></label>
                  <UtcDateTimePicker value={form.legion1_start_utc} onChange={v => setForm(f => ({ ...f, legion1_start_utc: v }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">Legion 2 Battle Time (UTC) <span className="text-red-400">*</span></label>
                  <UtcDateTimePicker value={form.legion2_start_utc} onChange={v => setForm(f => ({ ...f, legion2_start_utc: v }))} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Battle Start (UTC)</label>
                <UtcDateTimePicker value={form.battle_start_utc} onChange={v => setForm(f => ({ ...f, battle_start_utc: v }))} />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Battle End (UTC)</label>
                <UtcDateTimePicker value={form.battle_end_utc} onChange={v => setForm(f => ({ ...f, battle_end_utc: v }))} />
              </div>
            </div>
          )}
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
      )}

      {/* Custom Event Form */}
      {isCustom && (
        <form onSubmit={handleCustomSubmit} className="space-y-4">
          <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 text-xs text-purple-300">
            Custom events let you write your own battle plan and push instructions to all members — no AI generation needed.
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Event Name <span className="text-red-400">*</span></label>
            <Input
              required
              placeholder="e.g. Internal War Practice, Special Rally Night"
              value={customForm.name}
              onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Start Date & Time (UTC) <span className="text-red-400">*</span></label>
              <UtcDateTimePicker
                value={customForm.battle_start_utc}
                onChange={v => setCustomForm(f => ({ ...f, battle_start_utc: v }))}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">End Date & Time (UTC) <span className="text-slate-500">(optional)</span></label>
              <UtcDateTimePicker
                value={customForm.battle_end_utc}
                onChange={v => setCustomForm(f => ({ ...f, battle_end_utc: v }))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Battle Plan / Instructions</label>
            <p className="text-xs text-slate-500 mb-2">
              Write your plan here. Members will see this on their profile page and self-service URL.
            </p>
            <RichTextEditor
              value={customForm.custom_instructions}
              onChange={v => setCustomForm(f => ({ ...f, custom_instructions: v }))}
              rows={10}
              placeholder="## Overview&#10;Describe the event...&#10;&#10;## Instructions&#10;- Step 1&#10;- Step 2&#10;"
              uploadFolder={uploadFolderRef.current}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Visibility</label>
            <select
              value={customForm.visibility}
              onChange={e => setCustomForm(f => ({ ...f, visibility: e.target.value as any }))}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Members</option>
              <option value="r4_plus">R4+ Only</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Initial Status</label>
            <select
              value={customForm.status}
              onChange={e => setCustomForm(f => ({ ...f, status: e.target.value as any }))}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="planning">Draft (not visible to members yet)</option>
              <option value="registration">Published (visible to all members)</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" size="lg" disabled={loading}>
            {loading ? 'Creating...' : 'Create Custom Event'}
          </Button>
        </form>
      )}
    </div>
  )
}
