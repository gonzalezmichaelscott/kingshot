// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Shield, Calendar, Star, Sword } from 'lucide-react'
import { CombatStatsEditor } from '@/components/members/CombatStatsEditor'

interface Props {
  member: any
  heroes: any[]
  upcomingEvents: any[]
}

export function MemberPortal({ member, heroes, upcomingEvents }: Props) {
  const alliance = member.alliances
  const supabase = createClient()

  const [stats, setStats] = useState({
    power: member.power || 0,
    troop_count: member.troop_count || 0,
    march_size: member.march_size || 0,
    rally_capacity: member.rally_capacity || 0,
    timezone: member.timezone || 'UTC',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'stats' | 'combat' | 'availability' | 'heroes'>('stats')

  const existingCombatStats = (member.member_combat_stats as any[])?.[0]
  const assignments = member.event_availability || []

  async function saveStats() {
    setSaving(true)
    await supabase.from('members').update({
      ...stats,
      updated_at: new Date().toISOString(),
    }).eq('access_token', member.access_token)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
                    type="number"
                    value={stats[key]}
                    onChange={e => setStats(s => ({ ...s, [key]: parseInt(e.target.value) || 0 }))}
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
          <HeroesTab member={member} heroes={heroes} />
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

function HeroesTab({ member, heroes }: { member: any; heroes: any[] }) {
  const supabase = createClient()
  const memberHeroes: any[] = member.member_heroes || []
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ hero_id: heroes[0]?.id || '', star_level: 0, hero_level: 1, is_primary: false })
  const [saved, setSaved] = useState(false)

  async function addHero() {
    await supabase.from('member_heroes').upsert({
      member_id: member.id,
      hero_id: form.hero_id,
      star_level: form.star_level,
      hero_level: form.hero_level,
      is_primary: form.is_primary,
    }, { onConflict: 'member_id,hero_id' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      {memberHeroes.map((mh: any) => (
        <Card key={mh.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{mh.heroes?.name}</p>
              <p className="text-xs text-slate-400">Gen {mh.heroes?.generation} · ⭐ {mh.star_level} · Lvl {mh.hero_level}</p>
            </div>
            {mh.is_primary && <Badge variant="amber">Primary</Badge>}
          </CardContent>
        </Card>
      ))}

      {adding ? (
        <Card>
          <CardContent className="py-4 space-y-3">
            <select
              value={form.hero_id}
              onChange={e => setForm(f => ({ ...f, hero_id: e.target.value }))}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {heroes.map(h => (
                <option key={h.id} value={h.id}>{h.name} (Gen {h.generation})</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Star Level (0–5)</label>
                <Input type="number" min={0} max={5} value={form.star_level} onChange={e => setForm(f => ({ ...f, star_level: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hero Level</label>
                <Input type="number" min={1} max={60} value={form.hero_level} onChange={e => setForm(f => ({ ...f, hero_level: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="accent-amber-500" />
              <span className="text-sm">Primary hero</span>
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={addHero}>{saved ? 'Saved!' : 'Save Hero'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
          <Star size={16} className="mr-2" /> Add Hero
        </Button>
      )}
    </div>
  )
}
