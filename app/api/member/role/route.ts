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
      .select('id, alliance_id, linked_user_id, role').eq('id', body.member_id).single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Current role of the member being changed (drives demotion protection).
    // Unclaimed profiles (no linked account) use the in-game rank on members.role;
    // when the member later claims the profile they inherit this role.
    let currentRole: string | null = member.role || null
    if (member.linked_user_id) {
      const { data: targetProfile } = await svc
        .from('user_profiles')
        .select('role')
        .eq('id', member.linked_user_id)
        .maybeSingle()
      currentRole = targetProfile?.role || currentRole
    }

    // Actor editing their OWN record: may step down to any lower rank, never up.
    const isSelf = !!member.linked_user_id && member.linked_user_id === user.id

    // Permission: demotion-aware. Same alliance required for non-admins.
    const sameAlliance = actor?.alliance_id === member.alliance_id
    const allowed = isSelf
      ? canChangeRole(actor?.role, currentRole, body.new_role, true)
      : (actor?.role === 'system_admin'
        || (sameAlliance && canChangeRole(actor?.role, currentRole, body.new_role)))
    if (!allowed) {
      const reason = isSelf && body.new_role !== currentRole
        ? 'You cannot promote yourself'
        : "You don't have permission to assign this role"
      return NextResponse.json({ error: reason }, { status: 403 })
    }

    // Always update the member's IN-GAME rank.
    const { error: memberErr } = await svc.from('members')
      .update({ role: body.new_role, updated_at: new Date().toISOString() })
      .eq('id', member.id)
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

    // SECURITY — `system_admin` is a platform-level role. If the target user is a
    // system_admin, NEVER overwrite their user_profiles.role: they keep platform
    // access while their in-game rank (members.role) changes freely. Non-admins
    // update both, as before. Unclaimed profiles have no user_profiles row — the
    // role stored on members.role is inherited when the profile is claimed.
    if (member.linked_user_id && currentRole !== 'system_admin') {
      const { error } = await svc.from('user_profiles').upsert({
        id: member.linked_user_id,
        alliance_id: member.alliance_id,
        role: body.new_role,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
