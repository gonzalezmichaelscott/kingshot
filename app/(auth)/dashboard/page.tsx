// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Shield, Swords, User } from 'lucide-react'
import Link from 'next/link'
import { formatPower } from '@/lib/utils'
import { isMemberRole, roleLabel } from '@/lib/access'

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

    const { data: events } = await supabase
      .from('events')
      .select('*, event_types(name)')
      .eq('alliance_id', allianceId)
      .in('status', ['planning', 'registration', 'active'])
      .order('battle_start_utc', { ascending: true })

    const { data: assignments } = member ? await supabase
      .from('event_assignments')
      .select('*, events(name, battle_start_utc, event_types(name))')
      .eq('member_id', member.id) : { data: [] }

    return (
      <div className="max-w-3xl mx-auto space-y-6">
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
          <CardHeader><CardTitle className="flex items-center gap-2"><Swords size={18} className="text-amber-500" />My Assignments</CardTitle></CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map((a: any) => (
                  <div key={a.id} className="bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-medium">{a.events?.name || a.events?.event_types?.name}</p>
                      {a.events?.battle_start_utc && <span className="text-xs text-slate-400">{new Date(a.events.battle_start_utc).toLocaleString(undefined, { timeZone: 'UTC' })} UTC</span>}
                    </div>
                    <div className="flex gap-2 flex-wrap mt-1.5">
                      <Badge variant="amber">{a.role}</Badge>
                      {a.squad && <Badge variant="blue">Squad {a.squad}</Badge>}
                      {a.is_backup && <Badge variant="default">Backup</Badge>}
                    </div>
                    {a.reasoning && <p className="text-sm text-slate-300 mt-2">{a.reasoning}</p>}
                    {(a.time_window_start || a.time_window_end) && (
                      <p className="text-xs text-slate-400 mt-1">
                        Window: {a.time_window_start ? new Date(a.time_window_start).toLocaleString(undefined, { timeZone: 'UTC' }) : '—'} → {a.time_window_end ? new Date(a.time_window_end).toLocaleString(undefined, { timeZone: 'UTC' }) : '—'} UTC
                      </p>
                    )}
                  </div>
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
