// @ts-nocheck
'use client'
import { useState, useEffect, Component } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Shield, Calendar, Star, Sword, Copy, Check, Trash2, AlertTriangle, Gift, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { parseMarkdownToHtml } from '@/components/ui/RichTextEditor'
import { sanitizeHtml } from '@/lib/sanitize'
import { CombatStatsEditor } from '@/components/members/CombatStatsEditor'
import { HeroManager } from '@/components/members/HeroManager'
import { TroopDataEditor } from '@/components/members/TroopDataEditor'
import { WillingToMoveToggle } from '@/components/members/WillingToMoveToggle'
import { PreferredLanguageSelect } from '@/components/members/PreferredLanguageSelect'
import { GiftCodeRedeemer } from '@/components/gift-codes/GiftCodeRedeemer'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { GoogleTranslate } from '@/components/ui/GoogleTranslate'
import { TransferAllianceFlow } from '@/components/members/TransferAllianceFlow'
import { CheckCircle2, ArrowRightLeft } from 'lucide-react'

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
  /** Viewer is the logged-in owner of this claimed profile (enables transfer). */
  canTransfer?: boolean
  /** Viewer has an active account session (enables "Back to Dashboard"). */
  isLoggedIn?: boolean
  /** Arrived here via an old transferred self-service link. */
  wasRedirected?: boolean
}

export function MemberPortal({ member, memberHeroes, memberAvailability, heroes, upcomingEvents, memberAssignments = [], canTransfer = false, isLoggedIn = false, wasRedirected = false }: Props) {
  const alliance = member.alliances
  const router = useRouter()

  const [stats, setStats] = useState({
    power: member.power || '',
    march_size: member.march_size || '',
    rally_capacity: member.rally_capacity || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'stats' | 'combat' | 'troops' | 'availability' | 'heroes' | 'gifts'>('stats')

  const existingCombatStats = (member.member_combat_stats as any[])?.[0]
  const assignments = memberAvailability || []
  // Events where a leader set this member's attendance on their behalf.
  const leaderSetEventIds = new Set((memberAvailability || []).filter((a: any) => a.manually_set_by).map((a: any) => a.event_id))

  async function saveStats() {
    setSaving(true)
    setError('')
    const power = parseInt(String(stats.power)) || 0
    const march_size = parseInt(String(stats.march_size)) || 0
    const rally_capacity = parseInt(String(stats.rally_capacity)) || 0
    const payload = { access_token: member.access_token, power, march_size, rally_capacity }

    let res: Response
    try {
      res = await fetch('/api/member/stats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      setSaving(false)
      setError('Network error — please check your connection and try again.')
      return
    }
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed — your stats were not updated. Please try again.')
      return
    }
    // Immediately reflect the saved values locally so the page shows what was
    // saved without waiting on a server re-fetch. Mutating `member` keeps these
    // values consistent if the component re-renders before the refresh lands.
    setStats({ power, march_size, rally_capacity })
    member.power = power
    member.march_size = march_size
    member.rally_capacity = rally_capacity
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Also re-sync server data (the page is force-dynamic, so this returns fresh rows).
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Back to Dashboard — only for logged-in users (hidden for anonymous
            members opening the share link without an account). */}
        {isLoggedIn && (
          <div className="pt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-400 font-medium"
            >
              <ArrowLeft size={15} /> Back to Dashboard
            </Link>
          </div>
        )}

        {/* Redirected from an old (transferred) self-service link */}
        {wasRedirected && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center gap-3 mt-4">
            <ArrowRightLeft size={18} className="text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-200">You have been redirected to your updated profile.</p>
          </div>
        )}

        {/* Stats were carried over from a previous alliance profile */}
        {member.previous_alliance_id && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-3 mt-4">
            <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-200">Your stats and hero data have been transferred from your previous alliance profile.</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar
              gameId={member.game_id}
              memberId={member.id}
              playerName={member.player_name}
              sizeClass="w-12 h-12"
            />
            <div>
              <h1 className="text-xl font-bold">{member.player_name}</h1>
              <p className="text-slate-400 text-sm">
                {alliance ? `[${alliance.tag}] ${alliance.name}` : 'Not in an alliance'}
              </p>
              {/* Kingdom and level are lazily populated by PlayerAvatar's fetch;
                  we display them inline here via a sibling fetcher */}
              {member.game_id && (
                <PlayerInfoBadges gameId={member.game_id} />
              )}
            </div>
          </div>
          {/* Translate widget — top right of the header for international members */}
          <GoogleTranslate className="flex-shrink-0" />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-6 gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {([
            { key: 'stats', label: 'Stats', icon: Shield },
            { key: 'combat', label: 'Combat', icon: Sword },
            { key: 'troops', label: 'Troops', icon: User },
            { key: 'availability', label: 'Events', icon: Calendar },
            { key: 'heroes', label: 'Heroes', icon: Star },
            { key: 'gifts', label: 'Gifts', icon: Gift },
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
              <p className="text-xs text-slate-500">
                Troop count is calculated automatically from your Troops tab.
              </p>

              {error && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              <Button className="w-full" onClick={saveStats} disabled={saving}>
                {saving ? 'Saving…' : saved ? 'Saved! ✓' : 'Update Stats'}
              </Button>

              {/* Preferred language */}
              <PreferredLanguageSelect
                accessToken={member.access_token}
                initial={member.preferred_language}
              />

              {/* Willing to move for KVK */}
              <WillingToMoveToggle
                accessToken={member.access_token}
                initial={member.kvk_willing_to_move}
                setByLeaderName={member.kvk_willing_set_by ? 'your alliance leader' : null}
              />

              {/* Self-service alliance/kingdom transfer — only for the logged-in
                  owner of a claimed profile. */}
              {canTransfer && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Moved to a new server or alliance?</p>
                  <TransferAllianceFlow variant="link" sourceMemberId={member.id} />
                </div>
              )}
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
                  <AssignmentCard key={a.id} assignment={a} leaderConfirmed={leaderSetEventIds.has(a.event_id)} />
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
                if (ev.event_types?.slug === 'swordland_showdown') {
                  return (
                    <SwordlandLegionCard
                      key={ev.id}
                      event={ev}
                      accessToken={member.access_token}
                      existing={assignments.find((a: any) => a.event_id === ev.id)}
                      memberTimezone={member.timezone || 'UTC'}
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

        {/* Gift Codes Tab */}
        {tab === 'gifts' && (
          <SectionErrorBoundary label="Gift codes">
            <Card>
              <CardContent className="py-4">
                <GiftCodeRedeemer gameId={member.game_id} />
              </CardContent>
            </Card>
          </SectionErrorBoundary>
        )}

        {/* Profile deletion is intentionally NOT available here. Deleting a profile
            requires a claimed, logged-in account (or an R4/R5/admin acting on the
            member's behalf) so it can't be done by anyone holding the share link. */}
        <div className="mt-8 border-t border-slate-800 pt-6 space-y-2">
          <p className="text-xs text-slate-500 leading-relaxed">
            To leave this alliance, log in to your account and manage your alliance from your dashboard.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            To delete your profile, log in and claim your profile first. Contact your R4 or R5 if you need help.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Is this profile not yours?{' '}
            <Link href="/report-impersonation" className="text-amber-500/80 hover:text-amber-400 underline underline-offset-2">
              Report account impersonation
            </Link>
          </p>
        </div>
      </div>
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
  if (slug === 'castle_battle') return { start: 12, end: 17 } // single-alliance castle battle window
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
        {existing?.manually_set_by && (
          <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-2.5 text-xs text-green-300">
            Attendance confirmed by your alliance leader.
          </div>
        )}
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
                {slug === 'kvk_castle_battle' || slug === 'castle_battle' ? ' within the battle window (12:00–17:00 UTC)' : ''}.
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

function KvkTransferBadge() {
  return (
    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-semibold">
      KVK Transfer
    </span>
  )
}

function TransferNotice({ assignment }: { assignment: any }) {
  if (!assignment?.kvk_transfer) return null
  const alliance = assignment.transfer_alliance || 'another alliance'
  const leader = assignment.transfer_rally_leader || 'your assigned rally leader'
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200 leading-relaxed">
      You have been recommended to temporarily join <span className="font-semibold">{alliance}</span>'s rally.
      Coordinate with <span className="font-semibold">{leader}</span> to move to their alliance before the battle.
    </div>
  )
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
          {assignment.kvk_transfer && <KvkTransferBadge />}
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
      {assignment.kvk_transfer && (
        <div className="px-3 pt-3">
          <TransferNotice assignment={assignment} />
        </div>
      )}
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

function AssignmentCard({ assignment, leaderConfirmed }: { assignment: any; leaderConfirmed?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const role = assignment.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const eventName = assignment.events?.name || assignment.events?.event_types?.name || 'Event'
  const eventDate = assignment.events?.battle_start_utc
    ? new Date(assignment.events.battle_start_utc).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC'
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
              {assignment.kvk_transfer && <KvkTransferBadge />}
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
        <TransferNotice assignment={assignment} />
        {leaderConfirmed && (
          <div className="rounded-lg border border-green-600/40 bg-green-600/10 p-2 text-xs text-green-300">
            Attendance confirmed by your alliance leader.
          </div>
        )}
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

function SwordlandLegionCard({ event, accessToken, existing, memberTimezone }: { event: any; accessToken: string; existing: any; memberTimezone: string }) {
  const router = useRouter()
  const legion1 = event.legion1_start_utc || event.battle_start_utc
  const legion2 = event.legion2_start_utc
  const initial = existing?.will_attend && (existing.squad_preference === 'legion1' || existing.squad_preference === 'legion2')
    ? existing.squad_preference
    : 'none'
  const [choice, setChoice] = useState<'legion1' | 'legion2' | 'none'>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function fmt(iso: string | null) {
    if (!iso) return 'Time TBD'
    // Kingshot runs on UTC — always show 24-hour UTC, never the member's local time.
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }) + ' UTC'
  }

  async function save(next: 'legion1' | 'legion2' | 'none') {
    const prev = choice
    setChoice(next)
    setSaving(true)
    setError('')
    const attend = next === 'legion1' || next === 'legion2'
    const startIso = next === 'legion1' ? legion1 : next === 'legion2' ? legion2 : null
    let res: Response
    try {
      res = await fetch('/api/member/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          event_id: event.id,
          will_attend: attend,
          available_from_utc: startIso || null,
          available_to_utc: startIso ? new Date(new Date(startIso).getTime() + 3600000).toISOString() : null,
          squad_preference: attend ? next : '',
        }),
      })
    } catch {
      setSaving(false)
      setChoice(prev) // revert optimistic selection on network failure
      setError('Network error — your choice was not saved. Please try again.')
      return
    }
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setChoice(prev) // revert optimistic selection so the UI matches the DB
      setError(d.error || 'Save failed — your choice was not saved. Please try again.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  function Option({ value, label, time }: { value: 'legion1' | 'legion2' | 'none'; label: string; time: string | null }) {
    return (
      <label className={`flex items-center gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${choice === value ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800'}`}>
        <input
          type="radio"
          name={`legion-${event.id}`}
          checked={choice === value}
          onChange={() => save(value)}
          disabled={saving}
          className="w-4 h-4 accent-amber-500"
        />
        <div>
          <p className="text-sm font-medium">{label}</p>
          {time && <p className="text-xs text-slate-400">{time}</p>}
        </div>
      </label>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sword size={16} className="text-amber-500" />
          {event.name || 'Swordland Showdown'}
        </CardTitle>
        <p className="text-xs text-slate-400">Choose which Legion you&apos;ll fight with. Times shown in your timezone ({memberTimezone}).</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Option value="legion1" label="Legion 1" time={fmt(legion1)} />
        <Option value="legion2" label="Legion 2" time={fmt(legion2)} />
        <Option value="none" label="I cannot attend either" time={null} />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {saved && <p className="text-green-400 text-sm">Saved! ✓</p>}
      </CardContent>
    </Card>
  )
}

function CustomEventCard({ event, accessToken, existing }: { event: any; accessToken: string; existing: any }) {
  const router = useRouter()
  const [willAttend, setWillAttend] = useState(existing?.will_attend ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [showFull, setShowFull] = useState(false)

  const html = sanitizeHtml(event.custom_instructions_html || '')
  const status = event.status

  async function toggleAttend(attend: boolean) {
    setSaving(true)
    setError('')
    let res: Response
    try {
      res = await fetch('/api/member/availability', {
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
    } catch {
      setSaving(false)
      setError('Network error — your response was not saved. Please try again.')
      return
    }
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Save failed — your response was not saved. Please try again.')
      return
    }
    // Reflect the saved value locally so the checkbox matches the database.
    setWillAttend(attend)
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
                  <>{new Date(event.battle_start_utc).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} UTC</>
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
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </CardContent>
    </Card>
  )
}

