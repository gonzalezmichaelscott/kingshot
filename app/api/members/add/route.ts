// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { addableMemberRanks, isElevatedRank } from '@/lib/access'
import { z } from 'zod'

// FIX 3 — manually add a roster member with a starting rank that follows the
// role hierarchy.
//   - r1/r2/r3 (non-elevated): the member is inserted directly at that rank
//     (an R4/R5 is adding them, so approval is implicit).
//   - r4/r5 (elevated): the member is inserted at r3 and a PENDING profile_request
//     is created so an R5 / System Admin must approve the leadership rank —
//     leadership ranks are never granted instantly.
const schema = z.object({
  allianceId: z.string().uuid(),
  gameId: z.string().regex(/^\d+$/).max(32),
  playerName: z.string().max(120).optional().default(''),
  role: z.enum(['r1', 'r2', 'r3', 'r4', 'r5']),
})

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, alliance_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'system_admin'
  // Actor must be R4/R5/admin, and (unless admin) act within their own alliance.
  if (!['r4', 'r5', 'system_admin'].includes(profile?.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isAdmin && profile?.alliance_id !== body.allianceId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // The chosen rank must be one this actor is allowed to assign.
  if (!addableMemberRanks(profile?.role).includes(body.role)) {
    return NextResponse.json({ error: 'You cannot assign that rank.' }, { status: 403 })
  }

  const svc = createServiceClient()
  const elevated = isElevatedRank(body.role)
  const name = body.playerName.trim()

  // Insert the roster member. Elevated requests start at r3 until approved.
  const { data: insertedMember, error: insertErr } = await svc
    .from('members')
    .insert({
      alliance_id: body.allianceId,
      player_name: name,
      game_id: body.gameId,
      role: elevated ? 'r3' : body.role,
    })
    .select('id')
    .single()
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  if (!elevated) {
    return NextResponse.json({ ok: true, pendingApproval: false })
  }

  // Elevated rank → create a pending approval request (does not bypass approval).
  // Bind it to the member record we just created via source_member_id so the
  // approval route UPDATES that exact record instead of inserting a duplicate.
  const { error: reqErr } = await svc.from('profile_requests').insert({
    user_id: null,
    alliance_id: body.allianceId,
    governor_name: name || `Player ${body.gameId}`,
    player_id: body.gameId,
    requested_role: body.role,
    status: 'pending',
    source_member_id: insertedMember?.id || null,
  })
  if (reqErr) {
    // The member still exists at r3; surface the approval-record failure.
    return NextResponse.json({ error: `Member added, but the rank approval could not be created: ${reqErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pendingApproval: true })
}
