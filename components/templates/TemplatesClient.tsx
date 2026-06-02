// @ts-nocheck
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Edit2, Trash2, Copy, Check, FileText } from 'lucide-react'

interface Template {
  id: string
  title: string
  body: string
  category: string | null
}

interface Props {
  allianceId: string
  templates: Template[]
  canManage: boolean
}

function emptyForm() {
  return { id: null as string | null, title: '', category: '', body: '' }
}

export function TemplatesClient({ allianceId, templates, canManage }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Group by category (uncategorised last).
  const grouped = useMemo(() => {
    const map: Record<string, Template[]> = {}
    for (const t of templates) {
      const key = (t.category && t.category.trim()) || 'Uncategorised'
      ;(map[key] ||= []).push(t)
    }
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'Uncategorised') return 1
      if (b === 'Uncategorised') return -1
      return a.localeCompare(b)
    })
  }, [templates])

  function copy(t: Template) {
    navigator.clipboard.writeText(t.body)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(c => (c === t.id ? null : c)), 1500)
  }

  async function save() {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.body.trim()) { setError('Body is required.'); return }
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const payload: any = {
      alliance_id: allianceId,
      title: form.title.trim(),
      category: form.category.trim() || null,
      body: form.body,
      updated_at: new Date().toISOString(),
    }
    let err
    if (form.id) {
      ;({ error: err } = await supabase.from('message_templates').update(payload).eq('id', form.id))
    } else {
      payload.created_by = user?.id
      ;({ error: err } = await supabase.from('message_templates').insert(payload))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(null)
    router.refresh()
  }

  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.title}"?`)) return
    const { error: err } = await supabase.from('message_templates').delete().eq('id', t.id)
    if (err) { alert(err.message); return }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setError(''); setForm(emptyForm()) }}>
            <Plus size={14} className="mr-1.5" /> New Template
          </Button>
        </div>
      )}

      {templates.length === 0 && (
        <Card><CardContent className="py-8 text-center text-slate-400 text-sm">No templates yet.</CardContent></Card>
      )}

      {grouped.map(([category, items]) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-2">{category}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map(t => (
              <Card key={t.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.title}</p>
                      {t.category && <p className="text-[11px] text-slate-500">{t.category}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => copy(t)} title="Copy" className="text-slate-400 hover:text-amber-400 p-1">
                        {copiedId === t.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => { setError(''); setForm({ id: t.id, title: t.title, category: t.category || '', body: t.body }) }} title="Edit" className="text-slate-400 hover:text-amber-400 p-1">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => remove(t)} title="Delete" className="text-slate-400 hover:text-red-400 p-1">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {t.body.length > 100 ? t.body.slice(0, 100) + '…' : t.body}
                  </p>
                  {copiedId === t.id && <p className="text-[11px] text-green-400">Copied!</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Form modal */}
      {form && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800">
              <h2 className="font-semibold flex items-center gap-2"><FileText size={16} className="text-amber-500" />{form.id ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-100 p-1"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title <span className="text-red-400">*</span></label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. KVK Attendance Request" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category <span className="text-slate-500">(optional)</span></label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. KVK, Recruitment, Events" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Body <span className="text-red-400">*</span></label>
                <textarea rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder="Write the message members will receive…" />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
