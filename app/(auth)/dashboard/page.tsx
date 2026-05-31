// @ts-nocheck
﻿// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, Shield, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { formatPower } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*, alliances(*)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to Kingshot Hub</h1>
        <p className="text-slate-400 mb-6">Your account is set up but not linked to an alliance yet.</p>
        <Link href="/alliances/new" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-6 py-3 rounded-lg inline-block">
          Register your Alliance
        </Link>
      </div>
    )
  }

  const alliance = profile.alliances as any
  const allianceId = profile.alliance_id

  // Load upcoming events
  const { data: events } = allianceId ? await supabase
    .from('events')
    .select('*, event_types(name, slug)')
    .eq('alliance_id', allianceId)
    .in('status', ['planning', 'registration', 'active'])
    .order('battle_start_utc', { ascending: true })
    .limit(5) : { data: [] }

  // Load member count
  const { count: memberCount } = allianceId ? await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('alliance_id', allianceId) : { count: 0 }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Welcome back, {profile.display_name || user.email}
          </p>
        </div>
        <Badge variant={profile.role === 'r5' ? 'amber' : profile.role === 'r4' ? 'blue' : 'default'}>
          {profile.role?.toUpperCase()}
        </Badge>
      </div>

      {/* Alliance info */}
      {alliance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} className="text-amber-500" />
              [{alliance.tag}] {alliance.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Members</p>
                <p className="text-xl font-semibold">{memberCount ?? 0}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">KVK</p>
                <p className="text-xl font-semibold">{alliance.kvk_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 flex-wrap">
              <Link href={`/alliances/${allianceId}`} className="text-amber-500 hover:text-amber-400 text-sm">
                Alliance Hub â†’
              </Link>
              <Link href={`/alliances/${allianceId}/members`} className="text-amber-500 hover:text-amber-400 text-sm">
                Members â†’
              </Link>
              <Link href={`/alliances/${allianceId}/events`} className="text-amber-500 hover:text-amber-400 text-sm">
                Events â†’
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar size={20} className="text-amber-500" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((ev: any) => (
                <Link
                  key={ev.id}
                  href={`/alliances/${allianceId}/events/${ev.id}`}
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <div>
                    <p className="font-medium">{ev.name || ev.event_types?.name}</p>
                    <p className="text-sm text-slate-400">
                      {ev.battle_start_utc
                        ? new Date(ev.battle_start_utc).toLocaleString()
                        : 'Date TBD'}
                    </p>
                  </div>
                  <Badge variant={ev.status === 'active' ? 'green' : ev.status === 'registration' ? 'amber' : 'default'}>
                    {ev.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No upcoming events.</p>
          )}
          {allianceId && (
            <Link href={`/alliances/${allianceId}/events/new`} className="mt-4 inline-block text-amber-500 hover:text-amber-400 text-sm">
              + Create event
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

