// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function AddMemberButton({ allianceId }: { allianceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('members').insert({
      alliance_id: allianceId,
      player_name: name.trim(),
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    setName('')
    router.refresh()
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus size={16} className="mr-1" /> Add Member
      </Button>
    )
  }

  return (
    <form onSubmit={handleAdd} className="flex items-center gap-2">
      <Input
        autoFocus
        required
        placeholder="Player name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-48"
      />
      <Button type="submit" size="sm" disabled={loading}>{loading ? '...' : 'Add'}</Button>
      <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
        <X size={18} />
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  )
}
