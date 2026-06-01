// @ts-nocheck
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MemberPortal } from '@/components/members/MemberPortal'
import { ClaimProfileBanner } from '@/components/members/ClaimProfileBanner'

export default async function MemberTokenPage({ params }: { params: { token: string } }) {
  const supabase = createServiceClient()

  const { data: member } = await supabase
    .from('members')
    .select(`
      *,
      alliances(name, tag),
      member_combat_stats(*)
    `)
    .eq('access_token', params.token)
    .single()

  if (!member) notFound()

  // Check if this page is being visited by a logged-in user who doesn't own it
  let loggedInUserId: string | null = null
  let hasPendingClaim = false
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (user && !member.linked_user_id) {
      loggedInUserId = user.id
      // Check if they already have a pending claim
      const { data: existing } = await supabase
        .from('profile_claim_requests')
        .select('id')
        .eq('member_id', member.id)
        .eq('requesting_user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()
      hasPendingClaim = !!existing
    }
  } catch {
    // Not authenticated — that's fine
  }

  // Fetch the member's saved heroes explicitly (rather than relying on the
  // deeply-nested embed in the member query) so they always load and display.
  const { data: memberHeroes } = await supabase
    .from('member_heroes')
    .select('*, heroes(*)')
    .eq('member_id', member.id)
    .order('is_primary', { ascending: false })

  // Fetch saved event availability explicitly so previous responses always load.
  const { data: memberAvailability } = await supabase
    .from('event_availability')
    .select('*')
    .eq('member_id', member.id)

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
    <>
      {loggedInUserId && (
        <ClaimProfileBanner
          memberId={member.id}
          memberName={member.player_name}
          hasPendingClaim={hasPendingClaim}
        />
      )}
      <MemberPortal
        member={member}
        memberHeroes={memberHeroes || []}
        memberAvailability={memberAvailability || []}
        heroes={heroes || []}
        upcomingEvents={upcomingEvents || []}
      />
    </>
  )
}
