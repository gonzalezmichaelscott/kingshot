// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canChangeRole } from '@/lib/access'
import { z } from 'zod'

const schema = z.object({
  member_id: z.string().uuid(),
  new_role: z.enum(['r1', 'r2', 'r3', 'r4', 'r5']),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: member } = await svc.from('members')
      .select('id, alliance_id, linked_user_id').eq('id', body.member_id).single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    if (!member.linked_user_id) {
      return NextResponse.json({ error: 'Member has not created an account yet — role can be assigned once they log in' }, { status: 400 })
    }

    // Current role of the member being changed (drives demotion protection).
    const { data: targetProfile } = await svc
      .from('user_profiles')
      .select('role')
      .eq('id', member.linked_user_id)
      .maybeSingle()
    const currentRole = targetProfile?.role || null

    // Permission: demotion-aware. Same alliance required for non-admins.
    const sameAlliance = actor?.alliance_id === member.alliance_id
    const allowed = actor?.role === 'system_admin'
      || (sameAlliance && canChangeRole(actor?.role, currentRole, body.new_role))
    if (!allowed) {
      return NextResponse.json({ error: "You don't have permission to assign this role" }, { status: 403 })
    }

    const { error } = await svc.from('user_profiles').upsert({
      id: member.linked_user_id,
      alliance_id: member.alliance_id,
      role: body.new_role,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
