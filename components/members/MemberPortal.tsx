// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Shield, Calendar, Star, Sword } from 'lucide-react'
import { CombatStatsEditor } from '@/components/members/CombatStatsEditor'
import { HeroManager } from '@/components/members/HeroManager'

interface Props {
  member: any
  heroes: any[]
  upcomingEvents: any[]
}

export function MemberPortal({ member, heroes, upcomingEvents }: Props) {
  const alliance = member.alliances
  const router = useRouter()

  const [stats, setStats] = useState({
    power: member.power || '',
    troop_count: member.troop_count || '',
    march_size: member.march_size || '',
    rally_capacity: member.rally_capacity || '',
    timezone: member.timezone || 'UTC',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'stats' | 'combat' | 'availability' | 'heroes'>('stats')

  const existingCombatStats = (member.member_combat_stats as any[])?.[0]
  const assignments = member.event_availability || []

  async function saveStats() {
    setSaving(true)
    const payload = {
      access_token: member.access_token,
      power: parseInt(String(stats.power)) || 0,
      troop_count: parseInt(String(stats.troop_count)) || 0,
      march_size: parseInt(String(stats.march_size)) || 0,
      rally_capacity: parseInt(String(stats.rally_capacity)) || 0,
      timezone: stats.timezone || 'UTC',
    }
    await fetch('/api/member/stats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Re-fetch fresh data from the server rather than trusting local state
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4">
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
            <User className="text-amber-500" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{member.player_name}</h1>
            <p className="text-slate-400 text-sm">
              [{alliance?.tag}] {alliance?.name}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {([
            { key: 'stats', label: 'Stats', icon: Shield },
            { key: 'combat', label: 'Combat', icon: Sword },
            { key: 'availability', label: 'Events', icon: Calendar },
            { key: 'heroes', label: 'Heroes', icon: Star },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === key ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Stats Tab */}
        {tab === 'stats' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield size={18} className="text-amber-500" />
                My Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Power', key: 'power' as const },
                { label: 'Troop Count', key: 'troop_count' as const },
                { label: 'March Size', key: 'march_size' as const },
                { label: 'Rally Capacity', key: 'rally_capacity' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-sm text-slate-400 block mb-1">{label}</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={stats[key]}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9]/g, '')
                      setStats(s => ({ ...s, [key]: v === '' ? '' : parseInt(v) }))
                    }}
                  />
                </div>
              ))}
              <div>
                <label className="text-sm text-slate-400 block mb-1">Timezone</label>
                <Input
                  placeholder="UTC, America/New_York, Europe/London..."
                  value={stats.timezone}
                  onChange={e => setStats(s => ({ ...s, timezone: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={saveStats} disabled={saving}>
                {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Update Stats'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Combat Stats Tab */}
        {tab === 'combat' && (
          <CombatStatsEditor
            memberId={member.id}
            accessToken={member.access_token}
            existing={existingCombatStats}
          />
        )}

        {/* Availability Tab */}
        {tab === 'availability' && (
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(ev => (
                <AvailabilityCard
                  key={ev.id}
                  event={ev}
                  memberId={member.id}
                  existing={assignments.find((a: any) => a.event_id === ev.id)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <Calendar className="mx-auto text-slate-600 mb-3" size={32} />
                  <p className="text-slate-400 text-sm">No upcoming events to register for.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Heroes Tab */}
        {tab === 'heroes' && (
          <HeroManager
            accessToken={member.access_token}
            memberHeroes={member.member_heroes || []}
            heroes={heroes}
          />
        )}
      </div>
    </div>
  )
}

function AvailabilityCard({ event, memberId, existing }: { event: any; memberId: string; existing: any }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    will_attend: existing?.will_attend ?? false,
    available_from_utc: existing?.available_from_utc?.slice(0, 16) || '',
    available_to_utc: existing?.available_to_utc?.slice(0, 16) || '',
    squad_preference: existing?.squad_preference || '',
    notes: existing?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('event_availability').upsert({
      event_id: event.id,
      member_id: memberId,
      ...form,
      available_from_utc: form.available_from_utc || null,
      available_to_utc: form.available_to_utc || null,
    }, { onConflict: 'event_id,member_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{event.name || event.event_types?.name}</CardTitle>
        {event.battle_start_utc && (
          <p className="text-sm text-slate-400">{new Date(event.battle_start_utc).toLocaleString()}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.will_attend}
            onChange={e => setForm(f => ({ ...f, will_attend: e.target.checked }))}
            className="w-5 h-5 rounded accent-amber-500"
          />
          <span className="font-medium">I will attend</span>
        </label>
        {form.will_attend && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Available from (UTC)</label>
                <Input
                  type="datetime-local"
                  value={form.available_from_utc}
                  onChange={e => setForm(f => ({ ...f, available_from_utc: e.target.value }))}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Available to (UTC)</label>
                <Input
                  type="datetime-local"
                  value={form.available_to_utc}
                  onChange={e => setForm(f => ({ ...f, available_to_utc: e.target.value }))}
                  className="text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Squad preference (A/B)</label>
              <Input placeholder="A or B" value={form.squad_preference} onChange={e => setForm(f => ({ ...f, squad_preference: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Notes</label>
              <Input placeholder="Any notes for your leader…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </>
        )}
        <Button className="w-full" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Save Availability'}
        </Button>
      </CardContent>
    </Card>
  )
}

