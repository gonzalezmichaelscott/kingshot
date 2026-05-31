// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Shield, Calendar, Star, Sword } from 'lucide-react'
import { CombatStatsEditor } from '@/components/members/CombatStatsEditor'
import { HeroManager } from '@/components/members/HeroManager'

interface Props {
  member: any
  memberHeroes: any[]
  memberAvailability: any[]
  heroes: any[]
  upcomingEvents: any[]
}

export function MemberPortal({ member, memberHeroes, memberAvailability, heroes, upcomingEvents }: Props) {
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
  const assignments = memberAvailability || []

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
                  accessToken={member.access_token}
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
            memberHeroes={memberHeroes}
            heroes={heroes}
          />
        )}
      </div>
    </div>
  )
}

// Returns the inclusive UTC hour window [start, end] a member can pick within,
// based on the event type. The R4/R5 coordinator already sets the event date.
function eventWindow(slug: string | undefined, battleStartUtc: string | null) {
  if (slug === 'kvk_castle_battle') return { start: 12, end: 17 } // 5-hour castle window
  if (slug === 'tri_alliance_clash') {
    const h = battleStartUtc ? new Date(battleStartUtc).getUTCHours() : 0
    return { start: h, end: h + 1 } // single 1-hour event window
  }
  // swordland_showdown and any other event: full 24-hour day
  return { start: 0, end: 23 }
}

const fmtHour = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

function AvailabilityCard({ event, accessToken, existing }: { event: any; accessToken: string; existing: any }) {
  const router = useRouter()
  const slug = event.event_types?.slug
  const { start, end } = eventWindow(slug, event.battle_start_utc)

  // Build the event's calendar date (in UTC) for constructing timestamps
  const baseDate = event.battle_start_utc ? new Date(event.battle_start_utc) : new Date()
  const y = baseDate.getUTCFullYear()
  const mo = baseDate.getUTCMonth()
  const da = baseDate.getUTCDate()
  const tsForHour = (h: number) => new Date(Date.UTC(y, mo, da, h, 0, 0)).toISOString()

  const fromHours: number[] = []
  for (let h = start; h <= end - 1; h++) fromHours.push(h)

  const existingFrom = existing?.available_from_utc ? new Date(existing.available_from_utc).getUTCHours() : null
  const existingTo = existing?.available_to_utc ? new Date(existing.available_to_utc).getUTCHours() : null

  const [form, setForm] = useState({
    will_attend: existing?.will_attend ?? false,
    from_hour: existingFrom ?? start,
    to_hour: existingTo ?? Math.min(start + 1, end),
    squad_preference: existing?.squad_preference || '',
    notes: existing?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // "To" options are always after the selected "from" hour, within the window
  const toHours: number[] = []
  for (let h = form.from_hour + 1; h <= end; h++) toHours.push(h)

  async function save() {
    setSaving(true)
    setError('')
    const fromH = form.from_hour
    let toH = form.to_hour
    if (toH <= fromH) toH = Math.min(fromH + 1, end)

    const res = await fetch('/api/member/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        event_id: event.id,
        will_attend: form.will_attend,
        available_from_utc: form.will_attend ? tsForHour(fromH) : null,
        available_to_utc: form.will_attend ? tsForHour(toH) : null,
        squad_preference: form.squad_preference,
        notes: form.notes,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Re-fetch so the saved attendance state persists on reload
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{event.name || event.event_types?.name}</CardTitle>
        {event.battle_start_utc && (
          <p className="text-sm text-slate-400">
            Battle starts {fmtHour(new Date(event.battle_start_utc).getUTCHours())} UTC
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
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
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Select the UTC hours you're available
                {slug === 'kvk_castle_battle' ? ' within the battle window (12:00–17:00 UTC)' : ''}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Available from (UTC)</label>
                  <select
                    value={form.from_hour}
                    onChange={e => {
                      const nf = parseInt(e.target.value)
                      setForm(f => ({ ...f, from_hour: nf, to_hour: f.to_hour <= nf ? Math.min(nf + 1, end) : f.to_hour }))
                    }}
                    className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {fromHours.map(h => <option key={h} value={h}>{fmtHour(h)} UTC</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Available to (UTC)</label>
                  <select
                    value={form.to_hour}
                    onChange={e => setForm(f => ({ ...f, to_hour: parseInt(e.target.value) }))}
                    className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {toHours.map(h => <option key={h} value={h}>{fmtHour(h)} UTC</option>)}
                  </select>
                </div>
              </div>
            </div>

            {slug === 'swordland_showdown' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Squad preference (A/B)</label>
                <Input placeholder="A or B" value={form.squad_preference} onChange={e => setForm(f => ({ ...f, squad_preference: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Notes</label>
              <Input placeholder="Any notes for your leader…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button className="w-full" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved! ✓' : existing ? 'Update Availability' : 'Save Availability'}
        </Button>
      </CardContent>
    </Card>
  )
}

