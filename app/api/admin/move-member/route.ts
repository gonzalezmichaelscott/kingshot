// @ts-nocheck
/**
 * FIX 6 — System Admin: move ANY member to ANY alliance/kingdom directly.
 *
 * This bypasses the normal approval / leave-rejoin flow entirely. It is a direct
 * relocation of a single member record:
 *   - Updates members.alliance_id for the SPECIFIC member only.
 *   - If that member is linked to an account AND it is that account's active
 *     profile, also points user_profiles.alliance_id at the new alliance.
 *   - Does NOT deactivate the record, does NOT copy any data between records,
 *     does NOT touch player_name / game_id / avatar_url, does NOT create a
 *     rejoin request.
 *
 * system_admin only.
 *
 * Body: { member_id: uuid, target_alliance_id: uuid }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  member_id: z.string().uuid(),
  target_alliance_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const { member_id, target_alliance_id } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await authed
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (actor?.role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()

    // Load the SPECIFIC member record being moved.
    const { data: member } = await svc
      .from('members')
      .select('id, alliance_id, linked_user_id')
      .eq('id', member_id)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Verify the destination alliance exists and resolve its display name.
    const { data: target } = await svc
      .from('alliances')
      .select('id, name, tag')
      .eq('id', target_alliance_id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Target alliance not found' }, { status: 404 })

    if (member.alliance_id === target_alliance_id) {
      return NextResponse.json({ error: 'Member is already in that alliance.' }, { status: 400 })
    }

    // Direct relocation of THIS record only. Keep it active; never copy data.
    await svc.from('members').update({
      alliance_id: target_alliance_id,
      is_active: true,
      previous_alliance_id: member.alliance_id,
      updated_at: new Date().toISOString(),
    }).eq('id', member.id)

    // If the member is linked to an account and this is that account's ACTIVE
    // profile, repoint user_profiles at the new alliance so their session matches.
    // Never disturb the account when a non-active (alt) profile is moved.
    if (member.linked_user_id) {
      const { data: linkedProfile } = await svc
        .from('user_profiles')
        .select('active_member_id, alliance_id')
        .eq('id', member.linked_user_id)
        .maybeSingle()
      const movingActive =
        linkedProfile?.active_member_id === member.id ||
        (!linkedProfile?.active_member_id && linkedProfile?.alliance_id === member.alliance_id)
      if (movingActive) {
        await svc.from('user_profiles')
          .update({ alliance_id: target_alliance_id })
          .eq('id', member.linked_user_id)
      }
    }

    return NextResponse.json({ ok: true, alliance_name: `[${target.tag}] ${target.name}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
