// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

interface Kingdom { id: string; name: string; server_number: number | null }

export function NewAllianceForm({ kingdoms }: { kingdoms: Kingdom[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', tag: '', kingdom_id: kingdoms[0]?.id || '', newKingdom: '', newServer: '' })
  const [creatingKingdom, setCreatingKingdom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let kingdomId = form.kingdom_id

    if (creatingKingdom) {
      const { data: k, error: ke } = await supabase.from('kingdoms').insert({
        name: form.newKingdom,
        server_number: form.newServer ? parseInt(form.newServer) : null,
      }).select().single()
      if (ke) { setError(ke.message); setLoading(false); return }
      kingdomId = k.id
    }

    const { data: alliance, error: ae } = await supabase.from('alliances').insert({
      name: form.name,
      tag: form.tag.toUpperCase(),
      kingdom_id: kingdomId || null,
    }).select().single()

    if (ae) { setError(ae.message); setLoading(false); return }

    // Link current user as R5
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').upsert({
        id: user.id,
        alliance_id: alliance.id,
        role: 'r5',
      })
    }

    router.push(`/alliances/${alliance.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-slate-400 block mb-1">Alliance Name</label>
        <Input
          required
          placeholder="Iron Fist Alliance"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm text-slate-400 block mb-1">Alliance Tag (3-4 letters)</label>
        <Input
          required
          maxLength={4}
          placeholder="IFA"
          value={form.tag}
          onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 block mb-1">Kingdom</label>
        {!creatingKingdom && kingdoms.length > 0 ? (
          <div className="space-y-2">
            <select
              value={form.kingdom_id}
              onChange={e => setForm(f => ({ ...f, kingdom_id: e.target.value }))}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {kingdoms.map(k => (
                <option key={k.id} value={k.id}>{k.name} {k.server_number ? `#${k.server_number}` : ''}</option>
              ))}
            </select>
            <button type="button" className="text-sm text-amber-500 hover:text-amber-400" onClick={() => setCreatingKingdom(true)}>
              + Create new kingdom
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Kingdom name" value={form.newKingdom} onChange={e => setForm(f => ({ ...f, newKingdom: e.target.value }))} />
            <Input placeholder="Server number (optional)" type="number" value={form.newServer} onChange={e => setForm(f => ({ ...f, newServer: e.target.value }))} />
            {kingdoms.length > 0 && (
              <button type="button" className="text-sm text-slate-400 hover:text-slate-300" onClick={() => setCreatingKingdom(false)}>
                Use existing kingdom
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Creating...' : 'Create Alliance'}
      </Button>
    </form>
  )
}
