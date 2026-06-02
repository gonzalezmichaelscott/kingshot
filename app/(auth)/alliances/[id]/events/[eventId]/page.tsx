// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SwordlandEvent } from '@/components/events/SwordlandEvent'
import { KvkCastleEvent } from '@/components/events/KvkCastleEvent'
import { TriAllianceEvent } from '@/components/events/TriAllianceEvent'
import { GenericEventPage } from '@/components/events/GenericEventPage'
import { BattlePlansTab } from '@/components/events/BattlePlansTab'
import { EventPageWrapper } from '@/components/events/EventPageWrapper'
import { CustomEventDetail } from '@/components/events/CustomEventDetail'
import { requireAllianceAccess, canManageAlliance } from '@/lib/access'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { BackButton } from '@/components/nav/BackButton'
import { EditEventButton } from '@/components/events/EditEventButton'

export default async function EventDetailPage({ params }: { params: { id: string; eventId: string } }) {
  const supabase = createClient()

  const { profile } = await requireAllianceAccess(supabase, params.id)

  const { data: event } = await supabase
    .from('events')
    .select('*, event_types(*), alliances(name, tag, kingdoms(id, name, server_number))')
    .eq('id', params.eventId)
    .single()

  if (!event) notFound()

  const alliance = event.alliances as any
  const kingdom = alliance?.kingdoms

  const canManage = canManageAlliance(profile?.role)

  const [
    { data: availability },
    { data: assignments },
    { data: members },
  ] = await Promise.all([
    supabase.from('event_availability').select('*, members(id, player_name, power, march_size, rally_capacity)').eq('event_id', params.eventId),
    supabase.from('event_assignments').select('*, members(player_name)').eq('event_id', params.eventId),
    supabase.from('members').select('id, player_name, power, march_size, rally_capacity, troop_count, member_scores(overall_score, rally_leader_score, joiner_score)').eq('alliance_id', params.id).order('power', { ascending: false }),
  ])

  const slug = (event.event_types as any)?.slug
  const eventName = event.name || (event.event_types as any)?.name

  const breadcrumbs = [
    { label: 'Kingdoms', href: '/kingdoms' },
    ...(kingdom ? [{ label: `${kingdom.name}${kingdom.server_number ? ` #${kingdom.server_number}` : ''}`, href: `/kingdoms/${kingdom.id}` }] : []),
    { label: `[${alliance?.tag}] ${alliance?.name}`, href: `/alliances/${params.id}` },
    { label: 'Events', href: `/alliances/${params.id}/events` },
    { label: eventName || 'Event' },
  ]

  const nav = (
    <div className="max-w-5xl mx-auto">
      <Breadcrumbs items={breadcrumbs} />
      <BackButton href={`/alliances/${params.id}/events`} />
    </div>
  )

  const props = {
    event,
    availability: availability || [],
    assignments: assignments || [],
    members: members || [],
    allianceId: params.id,
    canManage,
    userId: profile?.id,
    breadcrumbs,
  }

  // Custom events: show custom detail page directly
  if ((event as any).is_custom) {
    return (
      <>
        {nav}
        <div className="max-w-5xl mx-auto">
          <CustomEventDetail
            event={event}
            canManage={canManage}
            allianceId={params.id}
            viewerLang={profile?.preferred_language || 'en'}
          />
        </div>
      </>
    )
  }

  // Standard events: wrap with Battle Plans tab
  const eventComponent =
    slug === 'swordland_showdown' ? <SwordlandEvent {...props} /> :
    slug === 'kvk_castle_battle' ? <KvkCastleEvent {...props} /> :
    slug === 'tri_alliance_clash' ? <TriAllianceEvent {...props} /> :
    <GenericEventPage {...props} />

  return (
    <>
      {nav}
      <div className="max-w-5xl mx-auto">
        {canManage && (
          <div className="flex justify-end mb-3">
            <EditEventButton event={event} />
          </div>
        )}
        <EventPageWrapper
          hasPlan={(assignments || []).length > 0}
          battlePlans={
            <BattlePlansTab
              event={event}
              assignments={assignments || []}
              canManage={canManage}
              allianceId={params.id}
            />
          }
        >
          {eventComponent}
        </EventPageWrapper>
      </div>
    </>
  )
}
