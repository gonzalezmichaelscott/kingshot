// @ts-nocheck
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MemberPortal } from '@/components/members/MemberPortal'

export default async function MemberTokenPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient()

  const { data: member } = await supabase
    .from('members')
    .select(`
      *,
      alliances(name, tag),
      member_combat_stats(*),
      event_availability(*, events(*, event_types(name)))
    `)
    .eq('access_token', params.token)
    .single()

  if (!member) notFound()

  // Fetch the member's saved heroes explicitly (rather than relying on the
  // deeply-nested embed in the member query) so they always load and display.
  const { data: memberHeroes } = await supabase
    .from('member_heroes')
    .select('*, heroes(*)')
    .eq('member_id', member.id)
    .order('is_primary', { ascending: false })

  const { data: heroes } = await supabase
    .from('heroes')
    .select('id, name, generation, troop_type, role, rarity, primary_role, has_widget, expedition_skill_count, expedition_skills')
    .eq('is_active', true)
    .order('generation')

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('*, event_types(name, slug)')
    .eq('alliance_id', member.alliance_id!)
    .in('status', ['planning', 'registration', 'active'])
    .gte('battle_start_utc', new Date().toISOString())
    .order('battle_start_utc')

  return (
    <MemberPortal
      member={member}
      memberHeroes={memberHeroes || []}
      heroes={heroes || []}
      upcomingEvents={upcomingEvents || []}
    />
  )
}
