// @ts-nocheck
'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { KvkVoiceChannel } from '@/lib/supabase/types'

const CHANNEL_NAMES = ['battle_leader', 'castle', 'north_turret', 'east_turret', 'south_turret', 'west_turret', 'general']

interface Props {
  kingdomId: string
  channels: KvkVoiceChannel[]
}

export function VoiceChannelManager({ kingdomId, channels }: Props) {
  const [form, setForm] = useState({ channel_name: CHANNEL_NAMES[0], discord_invite_url: '' })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    const existing = channels.find(c => c.channel_name === form.channel_name)
    if (existing) {
      await supabase.from('kvk_voice_channels')
        .update({ discord_invite_url: form.discord_invite_url, is_active: true })
        .eq('id', existing.id)
    } else {
      await supabase.from('kvk_voice_channels').insert({
        kingdom_id: kingdomId,
        channel_name: form.channel_name,
        discord_invite_url: form.discord_invite_url,
        minimum_role: form.channel_name === 'battle_leader' ? 'r4' : 'member',
      })
    }
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Channel Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Channel</label>
          <select
            value={form.channel_name}
            onChange={e => setForm(f => ({ ...f, channel_name: e.target.value }))}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {CHANNEL_NAMES.map(n => (
              <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Discord Invite URL</label>
          <Input
            type="url"
            placeholder="https://discord.gg/..."
            value={form.discord_invite_url}
            onChange={e => setForm(f => ({ ...f, discord_invite_url: e.target.value }))}
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save Channel Link'}
        </Button>
      </CardContent>
    </Card>
  )
}
