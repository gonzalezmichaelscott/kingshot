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
      .select('id, alliance_id, linked_user_id, alliances(name, tag)')
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

    // Set member alliance_id to NULL
    await service.from('members').update({ alliance_id: null }).eq('id', member.id)

    // Set linked user's alliance_id to NULL
    if (member.linked_user_id) {
      await service.from('user_profiles').update({ alliance_id: null }).eq('id', member.linked_user_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Leave alliance error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
