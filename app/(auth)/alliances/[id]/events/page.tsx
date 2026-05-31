// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus } from 'lucide-react'
import Link from 'next/link'
import { requireAllianceAccess, canManageAlliance } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'

const statusColor: Record<string, 'green' | 'amber' | 'blue' | 'default'> = {
  active: 'green',
  registration: 'amber',
  planning: 'blue',
  completed: 'default',
}

export default async function EventsListPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { profile } = await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('name, tag, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()
  if (!alliance) notFound()

  const kingdom = (alliance as any).kingdoms
  const canCreate = canManageAlliance(profile?.role)

  const { data: events } = await supabase
    .from('events')
    .select('*, event_types(name, slug)')
    .eq('alliance_id', params.id)
    .order('battle_start_utc', { ascending: false })

  const active = events?.filter(e => e.status !== 'completed') || []
  const completed = events?.filter(e => e.status === 'completed') || []

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}`, href: `/alliances/${params.id}` },
    { label: 'Events' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="text-amber-500" size={24} />
          Events — [{alliance.tag}]
        </h1>
        {canCreate && (
          <Link href={`/alliances/${params.id}/events/new`} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm">
            <Plus size={16} />
            New Event
          </Link>
        )}
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Active & Upcoming</h2>
          <div className="space-y-3">
            {active.map(ev => <EventRow key={ev.id} ev={ev} allianceId={params.id} />)}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Completed</h2>
          <div className="space-y-3">
            {completed.slice(0, 10).map(ev => <EventRow key={ev.id} ev={ev} allianceId={params.id} />)}
          </div>
        </div>
      )}

      {(!events || events.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto text-slate-600 mb-3" size={32} />
            <p className="text-slate-400">No events yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EventRow({ ev, allianceId }: { ev: any; allianceId: string }) {
  return (
    <Link href={`/alliances/${allianceId}/events/${ev.id}`}>
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-amber-500/50 transition-colors">
        <div>
          <p className="font-medium">{ev.name || ev.event_types?.name}</p>
          <p className="text-sm text-slate-400 mt-0.5">
            {ev.battle_start_utc
              ? new Date(ev.battle_start_utc).toLocaleString()
              : 'Date TBD'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{ev.event_types?.name}</span>
          <Badge variant={statusColor[ev.status] || 'default'}>{ev.status}</Badge>
        </div>
      </div>
    </Link>
  )
}
