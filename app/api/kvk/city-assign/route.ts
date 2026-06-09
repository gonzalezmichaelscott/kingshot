// @ts-nocheck
// FEATURE 3 — assign / remove a member to a castle-map city slot.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SLOT_BY_ID } from '@/lib/castle-map'
import { z } from 'zod'

const MANAGE_ROLES = ['r4', 'r5', 'kingdom_leader', 'system_admin']

const postSchema = z.object({
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  slotPosition: z.string().min(1),
})

async function requireManager() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!MANAGE_ROLES.includes(profile?.role || '')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireManager()
    if (error) return error

    const { eventId, memberId, slotPosition } = postSchema.parse(await request.json())
    if (!SLOT_BY_ID[slotPosition]) {
      return NextResponse.json({ error: 'Unknown slot position' }, { status: 400 })
    }

    const svc = createServiceClient()
    // A slot holds one member, and a member holds one slot — clear both first.
    await svc.from('kvk_city_assignments').delete().eq('event_id', eventId).eq('slot_position', slotPosition)
    await svc.from('kvk_city_assignments').delete().eq('event_id', eventId).eq('member_id', memberId)
    const { error: insErr } = await svc.from('kvk_city_assignments').insert({
      event_id: eventId,
      member_id: memberId,
      slot_position: slotPosition,
    })
    if (insErr) throw insErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('KVK city-assign error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error } = await requireManager()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const slotPosition = searchParams.get('slot')
    const memberId = searchParams.get('memberId')
    if (!eventId || (!slotPosition && !memberId)) {
      return NextResponse.json({ error: 'Missing eventId and slot/memberId' }, { status: 400 })
    }

    const svc = createServiceClient()
    let q = svc.from('kvk_city_assignments').delete().eq('event_id', eventId)
    q = slotPosition ? q.eq('slot_position', slotPosition) : q.eq('member_id', memberId)
    const { error: delErr } = await q
    if (delErr) throw delErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('KVK city-assign delete error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
