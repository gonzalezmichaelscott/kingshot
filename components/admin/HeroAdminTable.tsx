// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Edit2, X, Check } from 'lucide-react'
import { roleColor, troopTypeColor } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { Hero } from '@/lib/supabase/types'

interface Props { heroes: Hero[] }

const TROOP_TYPES = ['infantry', 'cavalry', 'archer', 'all'] as const
const ROLES = ['rally_leader', 'joiner', 'support', 'garrison', 'flex'] as const

export function HeroAdminTable({ heroes: initial }: Props) {
  const [heroes, setHeroes] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', generation: 1, troop_type: 'infantry', role: 'rally_leader' })
  const [editForm, setEditForm] = useState<any>({})
  const router = useRouter()
  const supabase = createClient()

  async function addHero() {
    const { data, error } = await supabase.from('heroes').insert({
      name: form.name,
      generation: form.generation,
      troop_type: form.troop_type,
      role: form.role,
    }).select().single()
    if (!error && data) {
      setHeroes(h => [...h, data])
      setAdding(false)
      setForm({ name: '', generation: 1, troop_type: 'infantry', role: 'rally_leader' })
    }
  }

  async function saveEdit(heroId: string) {
    const { data, error } = await supabase.from('heroes').update(editForm).eq('id', heroId).select().single()
    if (!error && data) {
      setHeroes(h => h.map(hero => hero.id === heroId ? data : hero))
      setEditing(null)
    }
  }

  async function toggleActive(heroId: string, current: boolean) {
    await supabase.from('heroes').update({ is_active: !current }).eq('id', heroId)
    setHeroes(h => h.map(hero => hero.id === heroId ? { ...hero, is_active: !current } : hero))
  }

  const genGroups = Array.from(new Set(heroes.map(h => h.generation))).sort()

  return (
    <div className="space-y-6">
      <Button onClick={() => setAdding(true)} disabled={adding}>
        <Plus size={16} className="mr-1" /> Add Hero
      </Button>

      {adding && (
        <Card>
          <CardHeader><CardTitle>Add New Hero</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hero name" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Generation</label>
                <Input type="number" min={1} value={form.generation} onChange={e => setForm(f => ({ ...f, generation: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Troop Type</label>
                <select value={form.troop_type} onChange={e => setForm(f => ({ ...f, troop_type: e.target.value }))}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addHero} disabled={!form.name}>Add Hero</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {genGroups.map(gen => (
        <Card key={gen}>
          <CardHeader>
            <CardTitle>Generation {gen}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="table-scroll">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-left py-2 pr-4">Troop Type</th>
                    <th className="text-left py-2 pr-4">Role</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {heroes.filter(h => h.generation === gen).map(hero => (
                    <tr key={hero.id} className="border-b border-slate-800/50">
                      {editing === hero.id ? (
                        <>
                          <td className="py-2 pr-4">
                            <Input value={editForm.name || hero.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} className="h-8 text-xs" />
                          </td>
                          <td className="py-2 pr-4">
                            <select value={editForm.troop_type || hero.troop_type}
                              onChange={e => setEditForm((f: any) => ({ ...f, troop_type: e.target.value }))}
                              className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-500">
                              {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <select value={editForm.role || hero.role}
                              onChange={e => setEditForm((f: any) => ({ ...f, role: e.target.value }))}
                              className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-500">
                              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4" />
                          <td className="py-2 flex gap-1 justify-center">
                            <button onClick={() => saveEdit(hero.id)} className="text-green-400 hover:text-green-300 p-1"><Check size={14} /></button>
                            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-200 p-1"><X size={14} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-4 font-medium">{hero.name}</td>
                          <td className="py-2 pr-4">
                            <span className={troopTypeColor(hero.troop_type || '')}>{hero.troop_type}</span>
                          </td>
                          <td className="py-2 pr-4">
                            <span className={roleColor(hero.role || '')}>{hero.role?.replace('_', ' ')}</span>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={hero.is_active ? 'green' : 'default'}>{hero.is_active ? 'Active' : 'Inactive'}</Badge>
                          </td>
                          <td className="py-2 flex gap-1 justify-center">
                            <button onClick={() => { setEditing(hero.id); setEditForm({ name: hero.name, troop_type: hero.troop_type, role: hero.role }) }}
                              className="text-slate-400 hover:text-amber-400 p-1"><Edit2 size={14} /></button>
                            <button onClick={() => toggleActive(hero.id, hero.is_active)}
                              className={`p-1 text-xs ${hero.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}>
                              {hero.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
