// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  request_type: z.enum(['new_kingdom', 'new_alliance']),
  kingdom_number: z.number().int().nullable().optional(),
  kingdom_name: z.string().nullable().optional(),
  kingdom_id: z.string().uuid().nullable().optional(),
  alliance_name: z.string().min(1),
  alliance_tag: z.string().min(2).max(4),
  governor_name: z.string().min(1),
  player_id: z.string().min(1),
  requested_role: z.enum(['r4', 'r5']),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { error } = await svc.from('kingdom_creation_requests').insert({
      user_id: user.id,
      request_type: body.request_type,
      kingdom_number: body.kingdom_number ?? null,
      kingdom_name: body.kingdom_name || null,
      kingdom_id: body.kingdom_id || null,
      alliance_name: body.alliance_name,
      alliance_tag: body.alliance_tag.toUpperCase(),
      governor_name: body.governor_name,
      player_id: body.player_id,
      requested_role: body.requested_role,
      status: 'pending',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
