// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SwordlandEvent } from '@/components/events/SwordlandEvent'
import { KvkCastleEvent } from '@/components/events/KvkCastleEvent'
import { TriAllianceEvent } from '@/components/events/TriAllianceEvent'
import { GenericEventPage } from '@/components/events/GenericEventPage'

export default async function EventDetailPage({ params }: { params: { id: string; eventId: string } }) {
  const supabase = createClient()

  const { data: event } = await supabase
    .from('events')
    .select('*, event_types(*), alliances(name, tag)')
    .eq('id', params.eventId)
    .single()

  if (!event) notFound()

  const { data: profile } = await supabase.from('user_profiles').select('role, id').single()
  const canManage = ['r5', 'r4', 'system_admin'].includes(profile?.role || '')

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

  const props = {
    event,
    availability: availability || [],
    assignments: assignments || [],
    members: members || [],
    allianceId: params.id,
    canManage,
    userId: profile?.id,
  }

  if (slug === 'swordland_showdown') return <SwordlandEvent {...props} />
  if (slug === 'kvk_castle_battle') return <KvkCastleEvent {...props} />
  if (slug === 'tri_alliance_clash') return <TriAllianceEvent {...props} />
  return <GenericEventPage {...props} />
}
