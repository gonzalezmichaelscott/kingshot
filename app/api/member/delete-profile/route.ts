// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/member/delete-profile
// Self-service profile deletion — authenticated via member access_token
export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json()
    if (!access_token) {
      return NextResponse.json({ error: 'access_token is required' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: member } = await service
      .from('members')
      .select('id, alliance_id, linked_user_id, access_token')
      .eq('access_token', access_token)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // If member has a linked user account, clear their alliance_id
    if (member.linked_user_id) {
      await service
        .from('user_profiles')
        .update({ alliance_id: null })
        .eq('id', member.linked_user_id)
    }

    // Delete member record (cascade removes combat stats, heroes, scores, assignments, availability)
    await service.from('members').delete().eq('id', member.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete profile error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
