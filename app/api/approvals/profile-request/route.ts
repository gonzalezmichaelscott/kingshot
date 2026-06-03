// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canApproveProfileRequest } from '@/lib/access'
import { allianceHasR5 } from '@/lib/leadership'
import { z } from 'zod'

const schema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  assigned_role: z.enum(['r1', 'r2', 'r3', 'r4', 'r5']).optional(),
  rejection_reason: z.string().optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: req } = await svc.from('profile_requests').select('*').eq('id', body.request_id).single()
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already resolved' }, { status: 400 })

    // Permission (leadership-aware):
    //  - r1/r2/r3 → any R4/R5 of the alliance (or admin)
    //  - r4/r5    → the alliance's R5 if one exists, else System Admin (fallback)
    const sameAlliance = actor?.alliance_id === req.alliance_id
    const hasR5 = await allianceHasR5(svc, req.alliance_id)
    const allowed = canApproveProfileRequest(actor?.role, req.requested_role, sameAlliance, hasR5)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (body.action === 'reject') {
      await svc.from('profile_requests').update({
        status: 'rejected',
        reviewed_by: user.id,
        rejection_reason: body.rejection_reason || null,
        updated_at: new Date().toISOString(),
      }).eq('id', req.id)
      // Clear the approval notifications from every approver's bell.
      await svc.from('notifications').update({ is_read: true }).eq('related_id', req.id)
      return NextResponse.json({ ok: true })
    }

    // Approve — assign role (admin may override via assigned_role), set alliance, create member
    const finalRole = body.assigned_role || req.requested_role

    await svc.from('user_profiles').upsert({
      id: req.user_id,
      alliance_id: req.alliance_id,
      role: finalRole,
      display_name: req.governor_name,
    })

    // Create or relink a member record for this user.
    //  1) An existing record already in THIS alliance → just refresh identity.
    //  2) A rejoin: the user owns a member record elsewhere / with no alliance
    //     (they left). Move that SAME record here so all stats/heroes/troop data
    //     carry over — do NOT create a new record.
    //  3) Otherwise (brand-new member) → insert a fresh record.
    const { data: ownMembers } = await svc.from('members')
      .select('id, alliance_id')
      .eq('linked_user_id', req.user_id)
      .order('updated_at', { ascending: false })

    const inThisAlliance = (ownMembers || []).find((m: any) => m.alliance_id === req.alliance_id)
    const elsewhere = (ownMembers || []).find((m: any) => m.alliance_id !== req.alliance_id)

    if (inThisAlliance?.id) {
      await svc.from('members').update({
        player_name: req.governor_name,
        game_id: req.player_id || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', inThisAlliance.id)
    } else if (elsewhere?.id) {
      // Rejoin / transfer: relink the existing record (stats intact).
      await svc.from('members').update({
        alliance_id: req.alliance_id,
        previous_alliance_id: elsewhere.alliance_id || null,
        is_active: true,
        player_name: req.governor_name,
        game_id: req.player_id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', elsewhere.id)
    } else {
      await svc.from('members').insert({
        alliance_id: req.alliance_id,
        player_name: req.governor_name,
        game_id: req.player_id || null,
        linked_user_id: req.user_id,
      })
    }

    await svc.from('profile_requests').update({
      status: 'approved', reviewed_by: user.id, updated_at: new Date().toISOString(),
    }).eq('id', req.id)

    // Clear the approval notifications from every approver's bell.
    await svc.from('notifications').update({ is_read: true }).eq('related_id', req.id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
