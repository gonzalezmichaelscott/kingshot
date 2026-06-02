// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isBackendRole } from '@/lib/access'
import { findPreviousMember, transferMember } from '@/lib/member-transfer'
import { z } from 'zod'

const schema = z.object({
  claim_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await authed
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!isBackendRole(actor?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()

    const { data: claim } = await svc
      .from('profile_claim_requests')
      .select('*, members(id, alliance_id, linked_user_id)')
      .eq('id', body.claim_id)
      .single()

    if (!claim) return NextResponse.json({ error: 'Claim request not found' }, { status: 404 })
    if (claim.status !== 'pending') return NextResponse.json({ error: 'Claim already resolved' }, { status: 400 })

    // Only the alliance's R4/R5 (or system_admin) can approve
    if (actor?.role !== 'system_admin' && actor?.alliance_id !== claim.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (body.action === 'reject') {
      await svc.from('profile_claim_requests').update({
        status: 'rejected',
        reviewed_by: user.id,
        rejection_reason: body.rejection_reason || null,
        updated_at: new Date().toISOString(),
      }).eq('id', claim.id)
      return NextResponse.json({ ok: true })
    }

    // Approve: link the member to the requesting user
    const member = (claim as any).members
    if (member?.linked_user_id) {
      return NextResponse.json({ error: 'This profile has already been claimed.' }, { status: 409 })
    }

    // Link member to user
    await svc.from('members').update({
      linked_user_id: claim.requesting_user_id,
      updated_at: new Date().toISOString(),
    }).eq('id', claim.member_id)

    // Feature 1 — Stat transfer when changing alliances.
    // If the claimer already has an active member record in another alliance,
    // carry their stats/heroes/combat/scores over to this newly-claimed record
    // and retire the old one (kept for history, linked forward for redirects).
    let transferred = false
    const previous = await findPreviousMember(svc, claim.requesting_user_id, claim.member_id)
    if (previous && previous.alliance_id !== claim.alliance_id) {
      await transferMember(svc, previous.id, claim.member_id)
      transferred = true
    }

    // Set user_profile alliance and role (default r3 if not set)
    const { data: requesterProfile } = await svc
      .from('user_profiles')
      .select('role')
      .eq('id', claim.requesting_user_id)
      .maybeSingle()

    await svc.from('user_profiles').upsert({
      id: claim.requesting_user_id,
      alliance_id: claim.alliance_id,
      role: requesterProfile?.role || 'r3',
    })

    // Mark all other pending claims for this member as rejected
    await svc.from('profile_claim_requests').update({
      status: 'rejected',
      rejection_reason: 'Another claim was approved for this profile.',
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
      .eq('member_id', claim.member_id)
      .eq('status', 'pending')
      .neq('id', claim.id)

    await svc.from('profile_claim_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    }).eq('id', claim.id)

    return NextResponse.json({ ok: true, transferred })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
