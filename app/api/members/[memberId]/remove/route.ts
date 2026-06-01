// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/members/[memberId]/remove
// Sets member's alliance_id to NULL (removes from alliance but keeps record)
// Also removes from upcoming event assignments
export async function POST(request: NextRequest, { params }: { params: { memberId: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actorProfile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!actorProfile || !['r5', 'r4', 'system_admin'].includes(actorProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = createServiceClient()

    // Load the member to verify ownership
    const { data: member } = await service
      .from('members')
      .select('id, alliance_id, linked_user_id')
      .eq('id', params.memberId)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Non-admin can only remove from their own alliance
    if (actorProfile.role !== 'system_admin' && member.alliance_id !== actorProfile.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Remove from all upcoming event assignments
    const { data: upcomingEvents } = await service
      .from('events')
      .select('id')
      .eq('alliance_id', member.alliance_id)
      .in('status', ['planning', 'registration', 'active'])

    if (upcomingEvents && upcomingEvents.length > 0) {
      const eventIds = upcomingEvents.map(e => e.id)
      await service
        .from('event_assignments')
        .delete()
        .eq('member_id', member.id)
        .in('event_id', eventIds)
      // Also remove availability registrations
      await service
        .from('event_availability')
        .delete()
        .eq('member_id', member.id)
        .in('event_id', eventIds)
    }

    // Set member alliance_id to NULL
    await service
      .from('members')
      .update({ alliance_id: null })
      .eq('id', member.id)

    // If member has a linked user account, remove their alliance_id too
    if (member.linked_user_id) {
      await service
        .from('user_profiles')
        .update({ alliance_id: null })
        .eq('id', member.linked_user_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove member error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
