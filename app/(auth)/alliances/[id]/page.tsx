// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Users, Calendar, BarChart3, MessageSquare, Sword, CalendarDays, Repeat } from 'lucide-react'
import Link from 'next/link'
import { formatPower, formatUtcDateTime } from '@/lib/utils'
import { requireAllianceAccess } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { KvkToggle } from '@/components/alliance/KvkToggle'
import { EditAllianceButton } from '@/components/alliance/EditAllianceButton'
import { GiftCodeRedeemer } from '@/components/gift-codes/GiftCodeRedeemer'
import { upcomingOccurrences, CALENDAR_COLORS } from '@/lib/calendar'

export default async function AllianceHubPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { profile } = await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('*, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()

  if (!alliance) notFound()

  const kingdom = alliance.kingdoms as any

  const [
    { count: memberCount },
    { data: recentEvents },
    { data: topMembers },
    { data: calendarEvents },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('alliance_id', params.id),
    supabase.from('events').select('*, event_types(name)').eq('alliance_id', params.id)
      .order('created_at', { ascending: false }).limit(3),
    supabase.from('members').select('player_name, power, member_scores(overall_score)')
      .eq('alliance_id', params.id).order('power', { ascending: false }).limit(5),
    supabase.from('alliance_calendar_events').select('*').eq('alliance_id', params.id),
  ])

  const upcoming = upcomingOccurrences(calendarEvents || [], new Date(), 5)

  const nav = [
    { href: `/alliances/${params.id}/members`, icon: Users, label: 'Members', count: memberCount },
    { href: `/alliances/${params.id}/events`, icon: Calendar, label: 'Events' },
    { href: `/alliances/${params.id}/chat`, icon: MessageSquare, label: 'Chat' },
    { href: `/alliances/${params.id}/analytics`, icon: BarChart3, label: 'Analytics' },
  ]

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}` },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="text-amber-500" size={24} />
            [{alliance.tag}] {alliance.name}
          </h1>
          {kingdom && (
            <p className="text-slate-400 text-sm mt-1">
              {kingdom.name} {kingdom.server_number ? `#${kingdom.server_number}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {alliance.kvk_enabled && <Badge variant="green">KVK Active</Badge>}
          {['r5', 'system_admin'].includes(profile?.role || '') && (
            <EditAllianceButton
              allianceId={params.id}
              currentName={alliance.name}
              currentTag={alliance.tag}
            />
          )}
        </div>
      </div>

      {/* KVK participation toggle + command link */}
      <KvkToggle
        allianceId={params.id}
        initialEnabled={!!alliance.kvk_enabled}
        canToggle={['r5', 'system_admin'].includes(profile?.role || '')}
      />

      {kingdom ? (
        <Link
          href={`/kingdoms/${kingdom.id}/kvk`}
          className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <Sword size={16} />
            KVK Command — {kingdom.name}
          </span>
          <span className="text-amber-400 text-sm">→</span>
        </Link>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          Join a kingdom first to access KVK coordination.
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {nav.map(({ href, icon: Icon, label, count }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-amber-500/50 transition-colors text-center py-4">
              <Icon className="mx-auto text-amber-500 mb-2" size={24} />
              <p className="font-medium text-sm">{label}</p>
              {count !== undefined && <p className="text-2xl font-bold mt-1">{count}</p>}
            </Card>
          </Link>
        ))}
      </div>

      {/* Upcoming calendar events widget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarDays size={18} className="text-amber-500" />
              Upcoming Events
            </span>
            <Link href={`/alliances/${params.id}/calendar`} className="text-amber-500 hover:text-amber-400 text-sm font-normal">
              Calendar →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {upcoming.map((o, i) => {
              const c = CALENDAR_COLORS[o.event.color] || CALENDAR_COLORS.amber
              return (
                <div key={o.event.id + i} className="flex items-center justify-between gap-3 p-2 bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="text-sm font-medium truncate">{o.event.title}</span>
                    {o.event.is_recurring && <Repeat size={12} className="text-slate-500 flex-shrink-0" />}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{formatUtcDateTime(o.date)}</span>
                </div>
              )
            })}
            {upcoming.length === 0 && (
              <p className="text-slate-400 text-sm">No upcoming events. <Link href={`/alliances/${params.id}/calendar`} className="text-amber-500 hover:text-amber-400">Add one →</Link></p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active gift codes — share with members (R4/R5 cannot redeem on their behalf) */}
      <Card>
        <CardContent className="py-4">
          <GiftCodeRedeemer mode="share" />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top players */}
        <Card>
          <CardHeader>
            <CardTitle>Top Members by Power</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topMembers?.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{m.player_name}</span>
                  <span className="text-sm text-amber-400">{formatPower(m.power)}</span>
                </div>
              ))}
              {(!topMembers || topMembers.length === 0) && (
                <p className="text-slate-400 text-sm">No members yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEvents?.map(ev => (
                <Link key={ev.id} href={`/alliances/${params.id}/events/${ev.id}`}>
                  <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                    <span className="text-sm">{ev.name || (ev.event_types as any)?.name}</span>
                    <Badge variant={ev.status === 'active' ? 'green' : 'default'}>{ev.status}</Badge>
                  </div>
                </Link>
              ))}
              {(!recentEvents || recentEvents.length === 0) && (
                <p className="text-slate-400 text-sm">No events yet.</p>
              )}
            </div>
            <Link href={`/alliances/${params.id}/events/new`} className="mt-3 block text-amber-500 hover:text-amber-400 text-sm">
              + Create event
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
