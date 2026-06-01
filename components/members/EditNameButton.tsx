// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

interface NameHistoryEntry {
  name: string
  changed_at: string
}

interface Props {
  memberId: string
  accessToken: string
  currentName: string
  nameHistory: NameHistoryEntry[]
}

export function EditNameButton({ memberId, accessToken, currentName, nameHistory }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function save() {
    if (!name.trim() || name.trim() === currentName) { setEditing(false); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/member/update-name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, player_name: name.trim() }),
    })

    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed')
      return
    }

    setSuccess(true)
    setEditing(false)
    setTimeout(() => setSuccess(false), 2000)
    router.refresh()
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {editing ? (
          <>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-sm w-48"
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            />
            <Button size="sm" className="h-8" onClick={save} disabled={saving || !name.trim()}>
              <Check size={14} />
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(false); setName(currentName) }}>
              <X size={14} />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-500 hover:text-amber-400 px-2"
            onClick={() => setEditing(true)}
          >
            <Edit2 size={12} className="mr-1" />
            Edit Name
          </Button>
        )}
        {success && <span className="text-xs text-green-400">Name updated successfully</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      {nameHistory && nameHistory.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Previous Names ({nameHistory.length})
          </button>
          {historyOpen && (
            <div className="mt-1 space-y-1 pl-2 border-l border-slate-700">
              {[...nameHistory].reverse().map((entry, i) => (
                <div key={i} className="text-xs text-slate-400">
                  <span className="text-slate-300">{entry.name}</span>
                  {' '}· {new Date(entry.changed_at).toLocaleDateString()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
