// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, X, Loader2 } from 'lucide-react'

interface Props {
  allianceId: string
  currentName: string
  currentTag: string
}

// Rename an alliance's display name + tag (R5 / system_admin only). Changes only
// the alliances table — self-service links, tokens and member records are unaffected.
export function EditAllianceButton({ allianceId, currentName, currentTag }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [tag, setTag] = useState(currentTag)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)

  function openModal() {
    setName(currentName)
    setTag(currentTag)
    setError('')
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/alliance/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allianceId, name: name.trim(), tag: tag.trim().toUpperCase() }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Failed to update alliance')
      return
    }
    setOpen(false)
    setToast(true)
    setTimeout(() => setToast(false), 4000)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium"
      >
        <Pencil size={14} /> Edit Alliance
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-800">
              <h2 className="font-semibold flex items-center gap-2">
                <Pencil size={15} className="text-amber-500" /> Edit Alliance
              </h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-100 p-1"><X size={18} /></button>
            </div>

            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Alliance Name <span className="text-red-400">*</span></label>
                <Input
                  autoFocus
                  required
                  maxLength={50}
                  placeholder="Alliance name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Alliance Tag <span className="text-red-400">*</span></label>
                <Input
                  required
                  maxLength={5}
                  placeholder="ABC"
                  value={tag}
                  onChange={e => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                />
                <p className="text-xs text-slate-500 mt-1">Up to 5 letters/numbers, shown as [TAG].</p>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving || !name.trim() || !tag.trim()}>
                  {saving ? <><Loader2 size={14} className="animate-spin mr-1" />Saving…</> : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[120] bg-slate-900 border border-green-500/40 text-green-200 text-sm rounded-xl shadow-2xl px-4 py-3">
          Alliance name updated successfully
        </div>
      )}
    </>
  )
}
