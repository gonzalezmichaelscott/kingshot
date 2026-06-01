// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { KvkVoiceChannel } from '@/lib/supabase/types'

// The 7 KVK channel slots in display order.
const CHANNELS: { name: string; label: string }[] = [
  { name: 'battle_leader', label: 'Battle Leader' },
  { name: 'castle', label: 'Castle' },
  { name: 'north_turret', label: 'North Turret' },
  { name: 'east_turret', label: 'East Turret' },
  { name: 'south_turret', label: 'South Turret' },
  { name: 'west_turret', label: 'West Turret' },
  { name: 'general', label: 'General' },
]

interface Props {
  kingdomId: string
  channels: KvkVoiceChannel[]
}

export function VoiceChannelManager({ kingdomId, channels }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(false)
  const [error, setError] = useState('')

  // Seed each slot's input from the existing row (if any).
  const [urls, setUrls] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const c of CHANNELS) {
      init[c.name] = channels.find(ch => ch.channel_name === c.name)?.discord_invite_url || ''
    }
    return init
  })

  async function saveChannel(name: string) {
    const url = urls[name]
    const existing = channels.find(c => c.channel_name === name)
    if (existing) {
      return supabase
        .from('kvk_voice_channels')
        .update({ discord_invite_url: url, is_active: true })
        .eq('id', existing.id)
    }
    return supabase.from('kvk_voice_channels').insert({
      kingdom_id: kingdomId,
      channel_name: name,
      discord_invite_url: url,
      minimum_role: name === 'battle_leader' ? 'r4' : 'member',
    })
  }

  async function handleSaveAll() {
    setSaving(true)
    setError('')
    try {
      for (const c of CHANNELS) {
        const { error } = await saveChannel(c.name)
        if (error) throw error
      }
      setSavedAt(true)
      setTimeout(() => setSavedAt(false), 2000)
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to save channels')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOne(name: string) {
    setSaving(true)
    setError('')
    try {
      const { error } = await saveChannel(name)
      if (error) throw error
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to save channel')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Channel Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHANNELS.map(c => (
          <div key={c.name}>
            <label className="text-sm text-slate-300 mb-1 block">
              {c.label}
              {c.name === 'battle_leader' && <span className="text-xs text-slate-500 ml-2">(R4/R5/admin only)</span>}
              {c.name === 'general' && <span className="text-xs text-slate-500 ml-2">(all members)</span>}
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://discord.gg/..."
                value={urls[c.name]}
                onChange={e => setUrls(u => ({ ...u, [c.name]: e.target.value }))}
              />
              <Button variant="secondary" size="md" onClick={() => handleSaveOne(c.name)} disabled={saving}>
                Save
              </Button>
            </div>
          </div>
        ))}

        <div className="pt-2 flex items-center gap-3">
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {savedAt ? 'Saved!' : 'Save All'}
          </Button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
