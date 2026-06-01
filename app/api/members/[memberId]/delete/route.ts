// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/members/[memberId]/delete
// Fully deletes the member record from the database
export async function DELETE(request: NextRequest, { params }: { params: { memberId: string } }) {
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

    // Load the member
    const { data: member } = await service
      .from('members')
      .select('id, alliance_id, linked_user_id')
      .eq('id', params.memberId)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Non-admin can only delete from their own alliance
    if (actorProfile.role !== 'system_admin' && member.alliance_id !== actorProfile.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // If member has a linked user account, set their alliance_id to NULL (don't delete auth account)
    if (member.linked_user_id) {
      await service
        .from('user_profiles')
        .update({ alliance_id: null })
        .eq('id', member.linked_user_id)
    }

    // Delete the member record (cascade will remove combat stats, heroes, scores, assignments, availability)
    await service
      .from('members')
      .delete()
      .eq('id', member.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
