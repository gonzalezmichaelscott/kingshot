// @ts-nocheck
/**
 * FIX 6 — System Admin: switch MY OWN alliance directly, with no approval and no
 * leave/rejoin flow.
 *
 *   - Updates user_profiles.alliance_id for the admin.
 *   - If the admin has an active member profile, moves that SAME member record to
 *     the new alliance too (no deactivation, no data copy, identity untouched).
 *
 * system_admin only.
 *
 * Body: { target_alliance_id: uuid }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  target_alliance_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const { target_alliance_id } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await authed
      .from('user_profiles')
      .select('role, active_member_id, alliance_id')
      .eq('id', user.id)
      .single()

    if (actor?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()

    const { data: target } = await svc
      .from('alliances')
      .select('id, name, tag')
      .eq('id', target_alliance_id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Target alliance not found' }, { status: 404 })

    // Resolve the admin's active member record (explicit pointer, else the member
    // in their current alliance). Move only that ONE record — never fan out.
    let activeMemberId = actor?.active_member_id || null
    if (!activeMemberId && actor?.alliance_id) {
      const { data: cm } = await svc
        .from('members')
        .select('id')
        .eq('linked_user_id', user.id)
        .eq('alliance_id', actor.alliance_id)
        .eq('is_active', true)
        .maybeSingle()
      activeMemberId = cm?.id || null
    }

    if (activeMemberId) {
      const { data: cur } = await svc
        .from('members')
        .select('id, alliance_id, linked_user_id')
        .eq('id', activeMemberId)
        .maybeSingle()
      // Only move a record the admin actually owns; never copy identity/data.
      if (cur && cur.linked_user_id === user.id) {
        await svc.from('members').update({
          alliance_id: target_alliance_id,
          is_active: true,
          previous_alliance_id: cur.alliance_id,
          updated_at: new Date().toISOString(),
        }).eq('id', cur.id)
      }
    }

    // Repoint the admin's account at the new alliance (role preserved).
    await svc.from('user_profiles').update({
      alliance_id: target_alliance_id,
      ...(activeMemberId ? { active_member_id: activeMemberId } : {}),
    }).eq('id', user.id)

    return NextResponse.json({ ok: true, alliance_name: `[${target.tag}] ${target.name}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
