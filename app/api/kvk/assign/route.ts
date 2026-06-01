// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { findOrCreateKingdomKvkEvent, roleForSquad, KVK_STRUCTURES } from '@/lib/kvk'
import { z } from 'zod'

const SQUADS = KVK_STRUCTURES.map(s => s.key)

const schema = z.object({
  kingdomId: z.string().uuid(),
  memberId: z.string().uuid(),
  squad: z.enum(SQUADS as [string, ...string[]]),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kingdomId, memberId, squad } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // R4/R5/system_admin may manually place players (same as event assignment writes).
    if (!['r4', 'r5', 'kingdom_leader', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { event, allianceIds } = await findOrCreateKingdomKvkEvent(kingdomId, true)
    if (!event) return NextResponse.json({ error: 'No participating alliances in this kingdom.' }, { status: 400 })

    const svc = createServiceClient()

    // Member must belong to a participating alliance in this kingdom.
    const { data: member } = await svc
      .from('members')
      .select('id, alliance_id')
      .eq('id', memberId)
      .single()
    if (!member || !allianceIds.includes(member.alliance_id)) {
      return NextResponse.json({ error: 'Member is not part of a participating alliance.' }, { status: 400 })
    }

    // Replace any existing assignment for this member on this event.
    await svc.from('event_assignments').delete().eq('event_id', event.id).eq('member_id', memberId)
    const { error } = await svc.from('event_assignments').insert({
      event_id: event.id,
      member_id: memberId,
      role: roleForSquad(squad),
      squad,
      is_primary: true,
      is_backup: false,
      reasoning: 'Manually assigned via KVK Command hub.',
    })
    if (error) throw error

    return NextResponse.json({ ok: true, eventId: event.id })
  } catch (error: any) {
    console.error('KVK assign error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
