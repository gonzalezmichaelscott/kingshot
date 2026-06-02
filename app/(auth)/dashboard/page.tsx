// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Shield, Swords, User } from 'lucide-react'
import Link from 'next/link'
import { formatPower } from '@/lib/utils'
import { isMemberRole, roleLabel } from '@/lib/access'
import { WillingToMoveToggle } from '@/components/members/WillingToMoveToggle'
import { DeleteOwnProfileButton } from '@/components/members/DeleteOwnProfileButton'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, alliances(*)')
    .eq('id', user.id)
    .single()

  if (!profile?.alliance_id && profile?.role !== 'system_admin') redirect('/onboarding')

  const alliance = profile.alliances as any
  const allianceId = profile.alliance_id

  // ---------- MEMBER DASHBOARD (R3 and below) ----------
  if (isMemberRole(profile.role)) {
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('linked_user_id', user.id)
      .eq('alliance_id', allianceId)
      .maybeSingle()

    // Fetch upcoming AND currently-active custom events (within 7-day window)
    const dashSevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: rawDashEvents } = await supabase
      .from('events')
      .select('*, event_types(name), is_custom, battle_end_utc')
      .eq('alliance_id', allianceId)
      .in('status', ['planning', 'registration', 'active'])
      .gte('battle_start_utc', dashSevenDaysAgo)
      .order('battle_start_utc', { ascending: true })
    const dashNow = new Date()
    const events = (rawDashEvents || []).filter((ev: any) => {
      const start = ev.battle_start_utc ? new Date(ev.battle_start_utc) : null
      if (!start) return true
      if (start >= dashNow) return true
      if (ev.is_custom) {
        if (ev.battle_end_utc) return new Date(ev.battle_end_utc) >= dashNow
        const sevenDaysAfterStart = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
        return sevenDaysAfterStart >= dashNow
      }
      return false
    })

    const { data: assignments } = member ? await supabase
      .from('event_assignments')
      .select('*, events(name, battle_start_utc, event_types(name, slug))')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false }) : { data: [] }

    // New custom events published in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: newCustomEvents } = allianceId ? await supabase
      .from('events')
      .select('id, name, battle_start_utc')
      .eq('alliance_id', allianceId)
      .eq('is_custom', true)
      .eq('status', 'registration')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }) : { data: [] }

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* New custom event notification banners */}
        {newCustomEvents && newCustomEvents.length > 0 && (
          <div className="space-y-2">
            {newCustomEvents.map((ev: any) => (
              <Link
                key={ev.id}
                href={`/alliances/${allianceId}/events/${ev.id}`}
                className="flex items-center justify-between gap-3 p-3 bg-purple-950/50 border border-purple-700/50 rounded-xl hover:border-purple-500 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-medium">New Event</span>
                  <span className="text-sm font-medium">{ev.name}</span>
                </div>
                {ev.battle_start_utc && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(ev.battle_start_utc).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })} UTC
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Profile card */}
        <Card>
          <CardContent className="pt-5 flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
              <User className="text-amber-500" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{member?.player_name || profile.display_name || 'Your profile'}</h1>
                <Badge variant="default">{roleLabel(profile.role)}</Badge>
              </div>
              <p className="text-slate-400 text-sm">{alliance ? `[${alliance.tag}] ${alliance.name}` : ''}</p>
            </div>
            {member && <div className="text-right"><p className="text-xs text-slate-400">Power</p><p className="font-semibold">{formatPower(member.power)}</p></div>}
          </CardContent>
        </Card>

        {/* My Assignments */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Swords size={18} className="text-amber-500" />My Battle Assignments</CardTitle></CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((a: any) => (
                  <details key={a.id} className="bg-slate-800 rounded-xl overflow-hidden">
                    <summary className="list-none p-3 cursor-pointer hover:bg-slate-750">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-medium">{a.events?.name || a.events?.event_types?.name}</p>
                        {a.events?.battle_start_utc && <span className="text-xs text-slate-400">{new Date(a.events.battle_start_utc).toLocaleString(undefined, { timeZone: 'UTC' })} UTC</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap mt-1.5">
                        <Badge variant="amber">{(a.role || '').replace(/_/g, ' ')}</Badge>
                        {a.events?.event_types?.slug === 'kvk_castle_battle' && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-semibold self-center">KVK</span>
                        )}
                        {a.squad && <Badge variant="blue">Squad {a.squad}</Badge>}
                        {a.is_backup && <Badge variant="default">Backup</Badge>}
                      </div>
                      {!a.member_instructions && a.reasoning && <p className="text-sm text-slate-300 mt-2">{a.reasoning}</p>}
                      {a.member_instructions && (
                        <p className="text-xs text-amber-400 mt-2">Click to view your full instructions →</p>
                      )}
                    </summary>
                    {a.member_instructions && (
                      <div className="px-3 pb-3 border-t border-slate-700">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed mt-2">
                          {a.member_instructions}
                        </pre>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No battle assignments yet. Your leaders will assign you once a plan is generated.</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events + availability */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar size={18} className="text-amber-500" />Upcoming Events</CardTitle></CardHeader>
          <CardContent>
            {events && events.length > 0 ? (
              <div className="space-y-2">
                {events.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                    <span className="text-sm">{ev.name || ev.event_types?.name}</span>
                    <Badge variant={ev.status === 'active' ? 'green' : ev.status === 'registration' ? 'amber' : 'default'}>{ev.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm">No upcoming events.</p>}
            {member?.access_token && (
              <Link href={`/member/${member.access_token}`} className="mt-4 inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm">
                Update my availability & stats
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Profile settings — only for a claimed (linked) profile */}
        {member?.access_token && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User size={18} className="text-amber-500" />Profile Settings</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <WillingToMoveToggle
                accessToken={member.access_token}
                initial={member.kvk_willing_to_move}
                setByLeaderName={member.kvk_willing_set_by ? 'your alliance leader' : null}
              />
              <DeleteOwnProfileButton accessToken={member.access_token} />
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ---------- LEADER DASHBOARD (R4/R5/system_admin) ----------
  const { data: events } = allianceId ? await supabase
    .from('events')
    .select('*, event_types(name, slug)')
    .eq('alliance_id', allianceId)
    .in('status', ['planning', 'registration', 'active'])
    .order('battle_start_utc', { ascending: true })
    .limit(5) : { data: [] }

  const { count: memberCount } = allianceId ? await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('alliance_id', allianceId) : { count: 0 }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back, {profile.display_name || user.email}</p>
        </div>
        <Badge variant={profile.role === 'r5' ? 'amber' : profile.role === 'r4' ? 'blue' : 'default'}>{roleLabel(profile.role)}</Badge>
      </div>

      {alliance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield size={20} className="text-amber-500" />[{alliance.tag}] {alliance.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><p className="text-slate-400 text-sm">Members</p><p className="text-xl font-semibold">{memberCount ?? 0}</p></div>
              <div><p className="text-slate-400 text-sm">KVK</p><p className="text-xl font-semibold">{alliance.kvk_enabled ? 'Enabled' : 'Disabled'}</p></div>
            </div>
            <div className="mt-4 flex gap-3 flex-wrap">
              <Link href={`/alliances/${allianceId}`} className="text-amber-500 hover:text-amber-400 text-sm">Alliance Hub →</Link>
              <Link href={`/alliances/${allianceId}/members`} className="text-amber-500 hover:text-amber-400 text-sm">Members →</Link>
              <Link href={`/alliances/${allianceId}/events`} className="text-amber-500 hover:text-amber-400 text-sm">Events →</Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar size={20} className="text-amber-500" />Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((ev: any) => (
                <Link key={ev.id} href={`/alliances/${allianceId}/events/${ev.id}`} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                  <div>
                    <p className="font-medium">{ev.name || ev.event_types?.name}</p>
                    <p className="text-sm text-slate-400">{ev.battle_start_utc ? new Date(ev.battle_start_utc).toLocaleString() : 'Date TBD'}</p>
                  </div>
                  <Badge variant={ev.status === 'active' ? 'green' : ev.status === 'registration' ? 'amber' : 'default'}>{ev.status}</Badge>
                </Link>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm">No upcoming events.</p>}
          {allianceId && <Link href={`/alliances/${allianceId}/events/new`} className="mt-4 inline-block text-amber-500 hover:text-amber-400 text-sm">+ Create event</Link>}
        </CardContent>
      </Card>
    </div>
  )
}
