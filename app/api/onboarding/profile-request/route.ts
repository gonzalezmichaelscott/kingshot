// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  alliance_id: z.string().uuid(),
  governor_name: z.string().min(1),
  player_id: z.string().optional().default(''),
  requested_role: z.enum(['r1', 'r2', 'r3', 'r4', 'r5']),
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

    const { error } = await svc.from('profile_requests').insert({
      user_id: user.id,
      alliance_id: body.alliance_id,
      governor_name: body.governor_name,
      player_id: body.player_id || null,
      requested_role: body.requested_role,
      status: 'pending',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
