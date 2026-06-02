// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid(),
  legion: z.enum(['legion1', 'legion2', 'none']),
})

// R4/R5/admin manually assigns a member to a Swordland legion (for members who
// coordinate in-game but don't use the app).
export async function POST(request: NextRequest) {
  try {
    const { event_id, member_id, legion } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events')
      .select('id, alliance_id, legion1_start_utc, legion2_start_utc, battle_start_utc').eq('id', event_id).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const attend = legion === 'legion1' || legion === 'legion2'
    const startIso = legion === 'legion1'
      ? (event.legion1_start_utc || event.battle_start_utc)
      : legion === 'legion2' ? event.legion2_start_utc : null

    const row = {
      event_id,
      member_id,
      will_attend: attend,
      available_from_utc: startIso || null,
      available_to_utc: startIso ? new Date(new Date(startIso).getTime() + 3600000).toISOString() : null,
      squad_preference: attend ? legion : null,
      submitted_at: new Date().toISOString(),
    }

    const { data: existing } = await svc.from('event_availability')
      .select('id').eq('event_id', event_id).eq('member_id', member_id).maybeSingle()
    if (existing?.id) {
      const { error } = await svc.from('event_availability').update(row).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await svc.from('event_availability').insert(row)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
