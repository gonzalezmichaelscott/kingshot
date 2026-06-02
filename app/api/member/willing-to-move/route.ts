// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  member_id: z.string().uuid(),
  kvk_willing_to_move: z.boolean(),
})

// POST /api/member/willing-to-move
// R4/R5/system_admin set a member's "willing to move for KVK" flag on their
// behalf. Records the leader's user id so the UI can show "Set by [leader]".
export async function POST(request: NextRequest) {
  try {
    const { member_id, kvk_willing_to_move } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = createServiceClient()

    // Verify the target member belongs to the leader's alliance (admins bypass).
    const { data: member } = await service
      .from('members')
      .select('id, alliance_id')
      .eq('id', member_id)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (profile.role !== 'system_admin' && member.alliance_id !== profile.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await service
      .from('members')
      .update({
        kvk_willing_to_move,
        kvk_willing_set_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
  }
}
