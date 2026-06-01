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

  // Fetch events: upcoming OR currently active custom events (started but end date not yet passed)
  // Use 7 days ago as cutoff so we capture recently-started events without a set end date
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso = new Date().toISOString()
  const { data: rawEvents } = await supabase
    .from('events')
    .select('*, event_types(name, slug), is_custom, custom_instructions_html, custom_images, battle_end_utc')
    .eq('alliance_id', member.alliance_id!)
    .in('status', ['planning', 'registration', 'active'])
    .gte('battle_start_utc', sevenDaysAgo)
    .order('battle_start_utc')

  // Client-side filter: keep upcoming events AND custom events still within their active window
  const now = new Date()
  const upcomingEvents = (rawEvents || []).filter(ev => {
    const start = ev.battle_start_utc ? new Date(ev.battle_start_utc) : null
    if (!start) return true
    // Future events always show
    if (start >= now) return true
    // Past-start custom events: show until end date (or 7 days after start if no end date)
    if (ev.is_custom) {
      if (ev.battle_end_utc) return new Date(ev.battle_end_utc) >= now
      const sevenDaysAfterStart = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      return sevenDaysAfterStart >= now
    }
    return false
  })

  // Load member's battle assignments with instructions
  const { data: memberAssignments } = await supabase
    .from('event_assignments')
    .select('*, events(name, battle_start_utc, event_types(name))')
    .eq('member_id', member.id)

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
        memberAssignments={memberAssignments || []}
      />
    </>
  )
}
