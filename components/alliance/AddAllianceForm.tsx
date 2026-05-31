// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  kingdomId: string
  kingdomName: string
  /** If true, redirect to the new alliance page after creation */
  redirectOnCreate?: boolean
}

export function AddAllianceForm({ kingdomId, kingdomName, redirectOnCreate = true }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const { data: alliance, error: err } = await supabase
      .from('alliances')
      .insert({
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        kingdom_id: kingdomId,
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Link current user as R5 of this alliance (if they don't already have one)
    if (user) {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('alliance_id, role')
        .eq('id', user.id)
        .single()

      if (!existing?.alliance_id) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          alliance_id: alliance.id,
          role: existing?.role || 'r5',
        })
      }
    }

    setLoading(false)
    setOpen(false)
    setName('')
    setTag('')

    if (redirectOnCreate) {
      router.push(`/alliances/${alliance.id}`)
    } else {
      router.refresh()
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={16} className="mr-1" />
        Add Alliance to {kingdomName}
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield size={16} className="text-amber-500" />
          Add Alliance to {kingdomName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Alliance Name</label>
            <Input
              required
              placeholder="Iron Fist Alliance"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Tag (2–4 letters)</label>
            <Input
              required
              maxLength={4}
              placeholder="IFA"
              value={tag}
              onChange={e => setTag(e.target.value.toUpperCase())}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading || !name || !tag}>
              {loading ? 'Creating…' : 'Create Alliance'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
