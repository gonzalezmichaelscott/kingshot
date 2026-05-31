// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  access_token: z.string(),
  player_name: z.string().min(1),
  game_id: z.string().optional().default(''),
  power: z.number().int().min(0),
  troop_count: z.number().int().min(0),
  march_size: z.number().int().min(0),
  rally_capacity: z.number().int().min(0),
  timezone: z.string(),
  notes: z.string().optional().default(''),
})

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, ...fields } = schema.parse(body)

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('members')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('access_token', access_token)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
