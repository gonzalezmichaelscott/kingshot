// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { profileRequestApprover, isBackendRole } from '@/lib/access'
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

    // Permission: r1-r3 → alliance r4/r5/admin; r4/r5 → system_admin only
    const approver = profileRequestApprover(req.requested_role)
    const isAdmin = actor?.role === 'system_admin'
    const isAllianceLeader = isBackendRole(actor?.role) && actor?.alliance_id === req.alliance_id
    const allowed = approver === 'system_admin' ? isAdmin : (isAdmin || isAllianceLeader)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (body.action === 'reject') {
      await svc.from('profile_requests').update({
        status: 'rejected',
        reviewed_by: user.id,
        rejection_reason: body.rejection_reason || null,
        updated_at: new Date().toISOString(),
      }).eq('id', req.id)
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

    // Create or relink a member record for this user in the alliance
    const { data: existingMember } = await svc.from('members')
      .select('id').eq('linked_user_id', req.user_id).eq('alliance_id', req.alliance_id).maybeSingle()
    if (existingMember?.id) {
      await svc.from('members').update({
        player_name: req.governor_name, game_id: req.player_id || null,
      }).eq('id', existingMember.id)
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

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
