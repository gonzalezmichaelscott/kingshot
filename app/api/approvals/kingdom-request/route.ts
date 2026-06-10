// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { seedStarterHeroes } from '@/lib/starter-heroes'
import { z } from 'zod'

const schema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  admin_role_override: z.enum(['r4', 'r5']).optional(),
  rejection_reason: z.string().optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role').eq('id', user.id).single()
    if (actor?.role !== 'system_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const svc = createServiceClient()
    const { data: req } = await svc.from('kingdom_creation_requests').select('*').eq('id', body.request_id).single()
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already resolved' }, { status: 400 })

    if (body.action === 'reject') {
      await svc.from('kingdom_creation_requests').update({
        status: 'rejected', reviewed_by: user.id,
        rejection_reason: body.rejection_reason || null, updated_at: new Date().toISOString(),
      }).eq('id', req.id)
      return NextResponse.json({ ok: true })
    }

    // Approve: create kingdom (if new), alliance, profile, member
    let kingdomId = req.kingdom_id
    if (req.request_type === 'new_kingdom' && !kingdomId) {
      const { data: k, error: kErr } = await svc.from('kingdoms')
        .insert({ name: req.kingdom_name, server_number: req.kingdom_number })
        .select('id').single()
      if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })
      kingdomId = k.id
    }

    const { data: alliance, error: aErr } = await svc.from('alliances')
      .insert({ name: req.alliance_name, tag: String(req.alliance_tag).toUpperCase(), kingdom_id: kingdomId })
      .select('id').single()
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

    const finalRole = body.admin_role_override || req.requested_role

    await svc.from('user_profiles').upsert({
      id: req.user_id, alliance_id: alliance.id, role: finalRole, display_name: req.governor_name,
    })

    const { data: newMember } = await svc.from('members').insert({
      alliance_id: alliance.id,
      player_name: req.governor_name,
      game_id: req.player_id || null,
      linked_user_id: req.user_id,
    }).select('id').single()
    await seedStarterHeroes(svc, [newMember?.id])

    await svc.from('kingdom_creation_requests').update({
      status: 'approved', reviewed_by: user.id,
      admin_role_override: body.admin_role_override || null, updated_at: new Date().toISOString(),
    }).eq('id', req.id)

    return NextResponse.json({ ok: true, alliance_id: alliance.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
