// @ts-nocheck
'use client'
import { useState, useEffect, Component } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Shield, Calendar, Star, Sword, Copy, Check, Trash2, AlertTriangle } from 'lucide-react'
import { parseMarkdownToHtml } from '@/components/ui/RichTextEditor'
import { CombatStatsEditor } from '@/components/members/CombatStatsEditor'
import { HeroManager } from '@/components/members/HeroManager'
import { TroopDataEditor } from '@/components/members/TroopDataEditor'
import { LeaveAllianceButton } from '@/components/members/LeaveAllianceButton'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'

class SectionErrorBoundary extends Component<
  { children: React.ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 text-center">
        <p className="text-red-400 text-sm">{this.props.label || 'This section'} failed to load. Try refreshing.</p>
      </div>
    )
    return this.props.children
  }
}

interface Props {
  member: any
  memberHeroes: any[]
  memberAvailability: any[]
  heroes: any[]
  upcomingEvents: any[]
  memberAssignments?: any[]
}

export function MemberPortal({ member, memberHeroes, memberAvailability, heroes, upcomingEvents, memberAssignments = [] }: Props) {
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
  const [tab, setTab] = useState<'stats' | 'combat' | 'troops' | 'availability' | 'heroes'>('stats')

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
        <div className="flex items-start justify-between gap-3 pt-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar
              gameId={member.game_id}
              playerName={member.player_name}
              sizeClass="w-12 h-12"
            />
            <div>
              <h1 className="text-xl font-bold">{member.player_name}</h1>
              <p className="text-slate-400 text-sm">
                [{alliance?.tag}] {alliance?.name}
              </p>
              {/* Kingdom and level are lazily populated by PlayerAvatar's fetch;
                  we display them inline here via a sibling fetcher */}
              {member.game_id && (
                <PlayerInfoBadges gameId={member.game_id} />
              )}
            </div>
          </div>
          {alliance && (
            <LeaveAllianceButton
              memberId={member.id}
              allianceName={`[${alliance.tag}] ${alliance.name}`}
              accessToken={member.access_token}
              redirectTo="/onboarding"
            />
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-5 gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {([
            { key: 'stats', label: 'Stats', icon: Shield },
            { key: 'combat', label: 'Combat', icon: Sword },
            { key: 'troops', label: 'Troops', icon: User },
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
          <SectionErrorBoundary label="Combat stats">
            <CombatStatsEditor
              memberId={member.id}
              accessToken={member.access_token}
              existing={existingCombatStats}
            />
          </SectionErrorBoundary>
        )}

        {/* Troops Tab */}
        {tab === 'troops' && (
          <SectionErrorBoundary label="Troop data">
            <TroopDataEditor
              accessToken={member.access_token}
              existing={member.troop_data}
            />
          </SectionErrorBoundary>
        )}

        {/* Availability Tab */}
        {tab === 'availability' && (
          <div className="space-y-4">
            {/* Battle assignments at top */}
            {memberAssignments.length > 0 && (
              <div className="space-y-3">
                {memberAssignments.map((a: any) => (
                  <AssignmentCard key={a.id} assignment={a} />
                ))}
              </div>
            )}

            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(ev => {
                const isCustom = (ev as any).is_custom
                if (isCustom) {
                  return (
                    <CustomEventCard
                      key={ev.id}
                      event={ev}
                      accessToken={member.access_token}
                      existing={assignments.find((a: any) => a.event_id === ev.id)}
                    />
                  )
                }
                return (
                  <AvailabilityCard
                    key={ev.id}
                    event={ev}
                    accessToken={member.access_token}
                    existing={assignments.find((a: any) => a.event_id === ev.id)}
                    assignment={memberAssignments.find((a: any) => a.event_id === ev.id)}
                  />
                )
              })
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
          <SectionErrorBoundary label="Heroes">
            <HeroManager
              accessToken={member.access_token}
              memberHeroes={memberHeroes}
              heroes={heroes}
            />
          </SectionErrorBoundary>
        )}

        {/* Danger Zone */}
        <DeleteProfileSection memberId={member.id} accessToken={member.access_token} playerName={member.player_name} />
      </div>
    </div>
  )
}

function DeleteProfileSection({ memberId, accessToken, playerName }: { memberId: string; accessToken: string; playerName: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/member/delete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Delete failed')
      }
      router.push('/onboarding')
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 border-t border-red-900/30 pt-6">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Danger Zone</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400 border border-red-800/40 hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={14} />
          Delete My Profile
        </button>
      ) : (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-slate-100 text-sm">Delete My Profile?</p>
              <p className="text-xs text-slate-400 mt-1">
                This will permanently delete your profile and all your data including stats, heroes, and assignments. This cannot be undone.
              </p>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Deleting…' : 'Yes, delete permanently'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tiny client component that fetches kingdom / level for the self-service header ──
function PlayerInfoBadges({ gameId }: { gameId: string }) {
  const [info, setInfo] = useState<{ kingdom?: number; level?: number } | null>(null)

  useEffect(() => {
    fetch(`/api/player-lookup?playerId=${encodeURIComponent(gameId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setInfo({ kingdom: json.data.kingdom, level: json.data.level })
      })
      .catch(() => {})
  }, [gameId])

  if (!info) return null

  return (
    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
      {info.level != null && info.level > 0 && (
        <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
          Lv.{info.level}
        </span>
      )}
      {info.kingdom != null && info.kingdom > 0 && (
        <span className="text-xs text-slate-400">Kingdom {info.kingdom}</span>
      )}
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

function AvailabilityCard({ event, accessToken, existing, assignment }: { event: any; accessToken: string; existing: any; assignment?: any }) {
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

        {/* Inline assignment card if plan exists */}
        {assignment?.member_instructions && (
          <MemberAssignmentInline assignment={assignment} />
        )}
      </CardContent>
    </Card>
  )
}

function roleBadgeStyle(role: string) {
  if (role.includes('leader')) return 'bg-amber-500 text-slate-900'
  if (role.includes('joiner')) return 'bg-blue-500 text-white'
  if (role.includes('garrison') || role.includes('castle') || role.includes('turret') || role.includes('defender'))
    return 'bg-green-600 text-white'
  return 'bg-slate-600 text-slate-200'
}

function KvkBadge() {
  return (
    <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-semibold">
      KVK
    </span>
  )
}
function isKvkAssignment(a: any) {
  return a?.events?.event_types?.slug === 'kvk_castle_battle'
}

function MemberAssignmentInline({ assignment }: { assignment: any }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const role = assignment.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  function copy() {
    navigator.clipboard.writeText(assignment.member_instructions || assignment.reasoning || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="bg-amber-500/10 p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Sword size={13} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-400">Your Assignment</span>
          {isKvkAssignment(assignment) && <KvkBadge />}
          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${roleBadgeStyle(assignment.role)}`}>
            {role}
          </span>
          {assignment.squad && (
            <span className="text-xs text-slate-400">Squad {assignment.squad}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          {expanded ? 'Hide' : 'View full instructions'}
        </button>
      </div>
      {expanded && (
        <div className="p-3 bg-slate-900 border-t border-amber-500/20">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
            {assignment.member_instructions || assignment.reasoning}
          </pre>
          <button
            onClick={copy}
            className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy My Assignment'}
          </button>
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: any }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const role = assignment.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const eventName = assignment.events?.name || assignment.events?.event_types?.name || 'Event'
  const eventDate = assignment.events?.battle_start_utc
    ? new Date(assignment.events.battle_start_utc).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UTC'
    : null

  function copy() {
    navigator.clipboard.writeText(assignment.member_instructions || assignment.reasoning || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${roleBadgeStyle(assignment.role)}`}>
                {role}
              </span>
              {isKvkAssignment(assignment) && <KvkBadge />}
              {assignment.squad && (
                <span className="text-xs text-slate-400">Squad {assignment.squad}</span>
              )}
              {assignment.is_backup && (
                <span className="text-xs text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded">Backup</span>
              )}
            </div>
            <p className="font-semibold mt-1">{eventName}</p>
            {eventDate && <p className="text-xs text-slate-400">{eventDate}</p>}
          </div>
          <Sword size={16} className="text-amber-500 flex-shrink-0 mt-1" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {assignment.reasoning && !expanded && (
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{assignment.reasoning}</p>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? 'Hide instructions' : 'View full assignment instructions'}
        </button>
        {expanded && (
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {assignment.member_instructions || assignment.reasoning || 'No instructions available.'}
            </pre>
            <button
              onClick={copy}
              className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy My Assignment'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CustomEventCard({ event, accessToken, existing }: { event: any; accessToken: string; existing: any }) {
  const router = useRouter()
  const [willAttend, setWillAttend] = useState(existing?.will_attend ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const html = event.custom_instructions_html || ''
  const status = event.status

  async function toggleAttend(attend: boolean) {
    setSaving(true)
    await fetch('/api/member/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        event_id: event.id,
        will_attend: attend,
        available_from_utc: null,
        available_to_utc: null,
      }),
    })
    setWillAttend(attend)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <Card className="border-purple-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium">
                Custom
              </span>
              {status === 'registration' && (
                <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-medium">
                  Published
                </span>
              )}
            </div>
            <CardTitle className="text-base">{event.name || 'Custom Event'}</CardTitle>
            {event.battle_start_utc && (
              <p className="text-sm text-slate-400 mt-0.5">
                {event.battle_end_utc ? (
                  <>
                    {new Date(event.battle_start_utc).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                    {' — '}
                    {new Date(event.battle_end_utc).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })} UTC
                  </>
                ) : (
                  <>{new Date(event.battle_start_utc).toLocaleString(undefined, { timeZone: 'UTC' })} UTC</>
                )}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {html && (
          <>
            {!showFull ? (
              <button
                onClick={() => setShowFull(true)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                View full instructions →
              </button>
            ) : (
              <div>
                <div
                  className="text-sm text-slate-200 leading-relaxed bg-slate-900 rounded-lg p-3 border border-slate-800"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <button
                  onClick={() => setShowFull(false)}
                  className="mt-2 text-xs text-slate-400 hover:text-slate-300"
                >
                  Hide
                </button>
              </div>
            )}
          </>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={willAttend}
            disabled={saving}
            onChange={e => toggleAttend(e.target.checked)}
            className="w-5 h-5 rounded accent-amber-500"
          />
          <span className="text-sm font-medium">
            {saved ? 'Saved!' : willAttend ? "I'll attend" : 'Mark as attending'}
          </span>
        </label>
      </CardContent>
    </Card>
  )
}

