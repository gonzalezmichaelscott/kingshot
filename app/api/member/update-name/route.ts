// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  access_token: z.string(),
  player_name: z.string().min(1),
})

export async function PATCH(request: NextRequest) {
  try {
    const { access_token, player_name } = schema.parse(await request.json())

    const svc = createServiceClient()

    const { data: current } = await svc
      .from('members')
      .select('player_name, name_history')
      .eq('access_token', access_token)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (current.player_name === player_name) return NextResponse.json({ ok: true })

    const history: any[] = Array.isArray(current.name_history) ? current.name_history : []
    history.push({ name: current.player_name, changed_at: new Date().toISOString() })

    const { error } = await svc
      .from('members')
      .update({ player_name, name_history: history, updated_at: new Date().toISOString() })
      .eq('access_token', access_token)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
