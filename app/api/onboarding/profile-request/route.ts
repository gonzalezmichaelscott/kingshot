// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { eligibleApproverUserIds } from '@/lib/leadership'
import { z } from 'zod'

const schema = z.object({
  alliance_id: z.string().uuid(),
  governor_name: z.string().min(1),
  player_id: z.string().optional().default(''),
  requested_role: z.enum(['r1', 'r2', 'r3', 'r4', 'r5']),
  // FEATURE 1 — additional-account request: approval creates a NEW linked member
  // instead of relinking the user's existing record.
  is_alt: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Replace any prior pending request from this user for this alliance
    await svc.from('profile_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('alliance_id', body.alliance_id)
      .eq('status', 'pending')

    const { data: created, error } = await svc.from('profile_requests').insert({
      user_id: user.id,
      alliance_id: body.alliance_id,
      governor_name: body.governor_name,
      player_id: body.player_id || null,
      requested_role: body.requested_role,
      status: 'pending',
      is_alt: body.is_alt || false,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify every eligible approver (Feature 3 — approval requests in the bell).
    try {
      const approverIds = await eligibleApproverUserIds(svc, body.alliance_id, body.requested_role)
      if (approverIds.length > 0) {
        const { data: alliance } = await svc
          .from('alliances').select('name, tag').eq('id', body.alliance_id).maybeSingle()
        const allianceName = alliance ? `[${alliance.tag}] ${alliance.name}` : 'an alliance'
        const rankLabel = (body.requested_role === 'r4' || body.requested_role === 'r5')
          ? body.requested_role.toUpperCase()
          : 'Member'
        const rows = approverIds.map((uid) => ({
          user_id: uid,
          type: 'approval_request',
          title: `${body.governor_name} is requesting to join ${allianceName} as ${rankLabel}`,
          message: body.player_id ? `Player ID: ${body.player_id}` : null,
          link: '/approvals',
          related_id: created.id,
        }))
        await svc.from('notifications').insert(rows)
      }
    } catch {
      // Notification failure must not block the request itself.
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
