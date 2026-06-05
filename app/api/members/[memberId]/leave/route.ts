// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/members/[memberId]/leave
// Called from self-service or admin view — member leaves their alliance
// Body: { access_token?: string } (for self-service) or just auth cookie (for admin view)
export async function POST(request: NextRequest, { params }: { params: { memberId: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const service = createServiceClient()

    // Load the member
    const { data: member } = await service
      .from('members')
      .select('id, alliance_id, linked_user_id, alliances!members_alliance_id_fkey(name, tag)')
      .eq('id', params.memberId)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Auth: either valid access_token or logged-in user who is r4+/self
    let authorized = false

    if (body.access_token && body.access_token === (await service.from('members').select('access_token').eq('id', params.memberId).single()).data?.access_token) {
      authorized = true
    }

    if (!authorized) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: actorProfile } = await supabase
          .from('user_profiles')
          .select('role, alliance_id')
          .eq('id', user.id)
          .single()
        if (actorProfile) {
          if (['r5', 'r4', 'system_admin'].includes(actorProfile.role)) authorized = true
          else if (member.linked_user_id === user.id) authorized = true
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for active events
    if (member.alliance_id) {
      const { data: activeEvent } = await service
        .from('events')
        .select('id, name')
        .eq('alliance_id', member.alliance_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (activeEvent) {
        return NextResponse.json({
          error: `Cannot leave during an active event: ${activeEvent.name}. Wait until the event ends.`
        }, { status: 409 })
      }
    }

    // FIX 3 — Operate on THIS specific member record only (params.memberId is the
    // authoritative identifier). Never "find any member of this user": a user may
    // own several profiles across alliances and only this one is being left.
    // Remove it from the alliance directory: clear the alliance link and mark the
    // record inactive so they no longer appear in the members list. We remember the
    // previous alliance so onboarding can greet them by name and so the SAME record
    // can be reused (stats intact) when they join a new one.
    await service.from('members').update({
      alliance_id: null,
      is_active: false,
      previous_alliance_id: member.alliance_id,
      updated_at: new Date().toISOString(),
    }).eq('id', member.id)

    // Only clear the linked user's alliance pointer when the profile they are
    // leaving is their CURRENTLY ACTIVE profile. If they have another profile
    // active (e.g. they left an alt), the user_profiles row must stay pointed at
    // that active profile's alliance — clearing it here would corrupt the session.
    if (member.linked_user_id) {
      const { data: userProfile } = await service
        .from('user_profiles')
        .select('active_member_id, alliance_id')
        .eq('id', member.linked_user_id)
        .maybeSingle()

      const leavingActive =
        userProfile?.active_member_id === member.id ||
        // Legacy rows with no explicit active_member_id: treat the member in the
        // user's current alliance as the active one.
        (!userProfile?.active_member_id && userProfile?.alliance_id === member.alliance_id)

      if (leavingActive) {
        await service.from('user_profiles')
          .update({ alliance_id: null, active_member_id: null })
          .eq('id', member.linked_user_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Leave alliance error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
