// @ts-nocheck
/**
 * Feature 2 — Server (Kingdom) / Alliance transfer.
 *
 * A logged-in player who owns a claimed profile moves to a different alliance
 * (possibly in a different kingdom/server). Their stats, heroes, troop data,
 * combat stats, scores, preferred language, willing-to-move flag, player id and
 * governor name carry over. Event history, chat and assignment history stay with
 * the old alliance.
 *
 * Body:
 *   target_alliance_id   (uuid, required)
 *   target_member_id     (uuid, optional) — an EXISTING profile in the new
 *                         alliance to claim/merge into. Omit to create a new one.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { transferMember } from '@/lib/member-transfer'
import { z } from 'zod'

const schema = z.object({
  target_alliance_id: z.string().uuid(),
  target_member_id: z.string().uuid().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // The user's current profile/alliance.
    const { data: profile } = await svc
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .maybeSingle()

    // Find the user's current active member record. Prefer the one in their
    // current alliance; otherwise the most recently updated active record.
    const { data: ownMembers } = await svc
      .from('members')
      .select('id, alliance_id, player_name, game_id, access_token')
      .eq('linked_user_id', user.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    const current =
      (ownMembers || []).find((m: any) => m.alliance_id === profile?.alliance_id) ||
      (ownMembers || [])[0]

    if (!current) {
      return NextResponse.json({ error: 'No claimed profile found to transfer.' }, { status: 400 })
    }

    if (current.alliance_id === body.target_alliance_id) {
      return NextResponse.json({ error: 'You are already in that alliance.' }, { status: 400 })
    }

    // Verify the target alliance exists.
    const { data: targetAlliance } = await svc
      .from('alliances')
      .select('id')
      .eq('id', body.target_alliance_id)
      .maybeSingle()
    if (!targetAlliance) {
      return NextResponse.json({ error: 'Target alliance not found.' }, { status: 404 })
    }

    // Resolve the destination member record.
    let targetMemberId: string

    if (body.target_member_id) {
      // Claim/merge into an existing profile in the new alliance.
      const { data: target } = await svc
        .from('members')
        .select('id, alliance_id, linked_user_id')
        .eq('id', body.target_member_id)
        .maybeSingle()

      if (!target || target.alliance_id !== body.target_alliance_id) {
        return NextResponse.json({ error: 'Selected profile not found in that alliance.' }, { status: 404 })
      }
      if (target.linked_user_id && target.linked_user_id !== user.id) {
        return NextResponse.json({ error: 'That profile is already linked to another account.' }, { status: 409 })
      }

      await svc.from('members').update({
        linked_user_id: user.id,
        // Player identity carries over to the claimed record.
        player_name: current.player_name,
        game_id: current.game_id,
        updated_at: new Date().toISOString(),
      }).eq('id', target.id)

      targetMemberId = target.id
    } else {
      // Create a fresh profile in the new alliance.
      const { data: created, error: createErr } = await svc
        .from('members')
        .insert({
          alliance_id: body.target_alliance_id,
          player_name: current.player_name,
          game_id: current.game_id,
          linked_user_id: user.id,
        })
        .select('id')
        .single()

      if (createErr || !created) {
        return NextResponse.json({ error: createErr?.message || 'Failed to create profile.' }, { status: 500 })
      }
      targetMemberId = created.id
    }

    // Carry over all stats/heroes/combat/scores and retire the old record.
    await transferMember(svc, current.id, targetMemberId)

    // Point the user's account at the new alliance. Leadership is alliance-
    // specific, so a transferring leader becomes a regular member (r3) in the
    // new alliance; platform admins keep their role.
    await svc.from('user_profiles').update({
      alliance_id: body.target_alliance_id,
      role: profile?.role === 'system_admin' ? 'system_admin' : 'r3',
    }).eq('id', user.id)

    // Return the new self-service token so the client can redirect there.
    const { data: newMember } = await svc
      .from('members')
      .select('access_token')
      .eq('id', targetMemberId)
      .maybeSingle()

    return NextResponse.json({ ok: true, access_token: newMember?.access_token || null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
