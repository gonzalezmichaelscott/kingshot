// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canApproveProfileRequest } from '@/lib/access'
import { allianceHasR5 } from '@/lib/leadership'
import { ensureUserProfileLinks, MAX_PROFILES_PER_ACCOUNT } from '@/lib/profiles'
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

    // FEATURE 1 — ALT request: create a brand-new linked member and add it as an
    // additional profile. Do NOT touch user_profiles (the user's active/primary
    // profile is unaffected) and do NOT relink their existing records.
    if (req.is_alt) {
      const { count } = await svc.from('members')
        .select('id', { count: 'exact', head: true })
        .eq('linked_user_id', req.user_id)
        .eq('is_active', true)
      if ((count || 0) >= MAX_PROFILES_PER_ACCOUNT) {
        return NextResponse.json({ error: `This user already has the maximum of ${MAX_PROFILES_PER_ACCOUNT} profiles.` }, { status: 400 })
      }
      const { data: newMember, error: insErr } = await svc.from('members').insert({
        alliance_id: req.alliance_id,
        player_name: req.governor_name,
        game_id: req.player_id || null,
        linked_user_id: req.user_id,
        role: finalRole,
        is_active: true,
      }).select('id').single()
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

      await svc.from('user_member_profiles').upsert(
        { user_id: req.user_id, member_id: newMember.id },
        { onConflict: 'user_id,member_id', ignoreDuplicates: true }
      )

      await svc.from('profile_requests').update({
        status: 'approved', reviewed_by: user.id, updated_at: new Date().toISOString(),
      }).eq('id', req.id)
      await svc.from('notifications').update({ is_read: true }).eq('related_id', req.id)
      return NextResponse.json({ ok: true, alt: true })
    }

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

    let resultMemberId: string | null = null
    if (inThisAlliance?.id) {
      await svc.from('members').update({
        player_name: req.governor_name,
        game_id: req.player_id || null,
        role: finalRole,
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', inThisAlliance.id)
      resultMemberId = inThisAlliance.id
    } else if (elsewhere?.id) {
      // Rejoin / transfer: relink the existing record (stats intact).
      await svc.from('members').update({
        alliance_id: req.alliance_id,
        previous_alliance_id: elsewhere.alliance_id || null,
        role: finalRole,
        is_active: true,
        player_name: req.governor_name,
        game_id: req.player_id || null,
        updated_at: new Date().toISOString(),
      }).eq('id', elsewhere.id)
      resultMemberId = elsewhere.id
    } else {
      const { data: insertedMember } = await svc.from('members').insert({
        alliance_id: req.alliance_id,
        player_name: req.governor_name,
        game_id: req.player_id || null,
        role: finalRole,
        linked_user_id: req.user_id,
      }).select('id').single()
      resultMemberId = insertedMember?.id || null
    }

    // This becomes the user's active profile; mirror it and keep the switcher in sync.
    if (resultMemberId) {
      await svc.from('user_profiles').update({ active_member_id: resultMemberId }).eq('id', req.user_id)
      await ensureUserProfileLinks(svc, req.user_id)
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
