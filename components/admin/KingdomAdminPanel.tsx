// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, Shield } from 'lucide-react'

interface Props { kingdoms: any[] }

export function KingdomAdminPanel({ kingdoms: initial }: Props) {
  const [kingdoms, setKingdoms] = useState(initial)
  const [form, setForm] = useState({ name: '', server_number: '' })
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  async function addKingdom() {
    const { data } = await supabase.from('kingdoms').insert({
      name: form.name,
      server_number: form.server_number ? parseInt(form.server_number) : null,
    }).select('*, alliances(id, name, tag, kvk_enabled)').single()
    if (data) {
      setKingdoms(k => [...k, data])
      setForm({ name: '', server_number: '' })
      setAdding(false)
    }
  }

  async function toggleKvk(allianceId: string, current: boolean) {
    await supabase.from('alliances').update({ kvk_enabled: !current }).eq('id', allianceId)
    setKingdoms(ks => ks.map(k => ({
      ...k,
      alliances: k.alliances?.map((a: any) => a.id === allianceId ? { ...a, kvk_enabled: !current } : a)
    })))
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setAdding(!adding)} size="sm">
        <Plus size={16} className="mr-1" /> Add Kingdom
      </Button>

      {adding && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <Input placeholder="Kingdom name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Server number" type="number" value={form.server_number} onChange={e => setForm(f => ({ ...f, server_number: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" onClick={addKingdom} disabled={!form.name}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {kingdoms.map(k => (
        <Card key={k.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe size={16} className="text-amber-500" />
              {k.name}
              {k.server_number && <span className="text-slate-400 font-normal text-sm">#{k.server_number}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {k.alliances?.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-amber-500" />
                    <span className="text-sm font-medium">[{a.tag}] {a.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.kvk_enabled ? 'green' : 'default'}>
                      {a.kvk_enabled ? 'KVK On' : 'KVK Off'}
                    </Badge>
                    <button
                      onClick={() => toggleKvk(a.id, a.kvk_enabled)}
                      className="text-xs text-slate-400 hover:text-amber-400"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              ))}
              {(!k.alliances || k.alliances.length === 0) && (
                <p className="text-slate-400 text-sm">No alliances in this kingdom.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
