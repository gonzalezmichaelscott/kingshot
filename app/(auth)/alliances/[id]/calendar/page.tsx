// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { requireAllianceAccess, canManageAlliance } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { AllianceCalendar } from '@/components/calendar/AllianceCalendar'

export default async function CalendarPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { profile } = await requireAllianceAccess(supabase, params.id)

  const { data: alliance } = await supabase
    .from('alliances')
    .select('name, tag, kingdoms(id, name, server_number)')
    .eq('id', params.id)
    .single()

  if (!alliance) notFound()
  const kingdom = (alliance as any)?.kingdoms

  const { data: events } = await supabase
    .from('alliance_calendar_events')
    .select('*')
    .eq('alliance_id', params.id)
    .order('event_date', { ascending: true })

  const canManage = canManageAlliance(profile?.role)

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance.tag}] ${alliance.name}`, href: `/alliances/${params.id}` },
    { label: 'Calendar' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="text-amber-500" size={24} />
            Alliance Calendar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Schedule reminders and recurring events. All times are UTC (24-hour).
            {!canManage && ' Viewing only — R4/R5 can add events.'}
          </p>
        </div>
      </div>

      <AllianceCalendar allianceId={params.id} events={events || []} canManage={canManage} />
    </div>
  )
}
