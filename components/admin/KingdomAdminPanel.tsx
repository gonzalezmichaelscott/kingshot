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
  // per-kingdom add-alliance state
  const [allianceForms, setAllianceForms] = useState<Record<string, { open: boolean; name: string; tag: string }>>({})
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

  function getAllianceForm(kingdomId: string) {
    return allianceForms[kingdomId] || { open: false, name: '', tag: '' }
  }

  function setAllianceForm(kingdomId: string, patch: Partial<{ open: boolean; name: string; tag: string }>) {
    setAllianceForms(prev => ({
      ...prev,
      [kingdomId]: { ...getAllianceForm(kingdomId), ...patch },
    }))
  }

  async function addAlliance(kingdomId: string) {
    const af = getAllianceForm(kingdomId)
    const { data } = await supabase.from('alliances').insert({
      kingdom_id: kingdomId,
      name: af.name.trim(),
      tag: af.tag.trim().toUpperCase(),
    }).select().single()
    if (data) {
      setKingdoms(ks => ks.map(k => k.id === kingdomId
        ? { ...k, alliances: [...(k.alliances || []), data] }
        : k
      ))
      setAllianceForm(kingdomId, { open: false, name: '', tag: '' })
    }
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

      {kingdoms.map(k => {
        const af = getAllianceForm(k.id)
        return (
          <Card key={k.id}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe size={16} className="text-amber-500" />
                  {k.name}
                  {k.server_number && <span className="text-slate-400 font-normal text-sm">#{k.server_number}</span>}
                </CardTitle>
                <Button size="sm" variant="secondary" onClick={() => setAllianceForm(k.id, { open: !af.open })}>
                  <Plus size={14} className="mr-1" /> Add Alliance
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add Alliance inline form */}
              {af.open && (
                <div className="bg-slate-800 rounded-lg p-3 space-y-2 mb-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">New Alliance</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Alliance name"
                      value={af.name}
                      onChange={e => setAllianceForm(k.id, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      placeholder="TAG"
                      maxLength={4}
                      value={af.tag}
                      onChange={e => setAllianceForm(k.id, { tag: e.target.value.toUpperCase() })}
                      className="w-24"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addAlliance(k.id)} disabled={!af.name || !af.tag}>Create</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAllianceForm(k.id, { open: false })}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Alliance list */}
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
                  <p className="text-slate-400 text-sm">No alliances yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
