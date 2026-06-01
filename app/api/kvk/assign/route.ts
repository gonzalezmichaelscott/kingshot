// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getKvkContext, roleForSquad, KVK_STRUCTURES, MANUAL_MARKER } from '@/lib/kvk'
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

    const svc = createServiceClient()

    const { data: member } = await svc
      .from('members')
      .select('id, alliance_id')
      .eq('id', memberId)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 400 })

    // The assignment must live on the member's OWN alliance active KVK event.
    const { alliances } = await getKvkContext(kingdomId)
    const allianceCtx = alliances.find(a => a.id === member.alliance_id)
    if (!allianceCtx?.activeEvent) {
      return NextResponse.json({ error: "This member's alliance has no active KVK event." }, { status: 400 })
    }
    const eventId = allianceCtx.activeEvent.id

    // Replace any existing assignment for this member on this event.
    await svc.from('event_assignments').delete().eq('event_id', eventId).eq('member_id', memberId)
    const { error } = await svc.from('event_assignments').insert({
      event_id: eventId,
      member_id: memberId,
      role: roleForSquad(squad),
      squad,
      is_primary: true,
      is_backup: false,
      reasoning: `${MANUAL_MARKER} to ${squad.replace(/_/g, ' ')} via KVK Command hub.`,
    })
    if (error) throw error

    return NextResponse.json({ ok: true, eventId })
  } catch (error: any) {
    console.error('KVK assign error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
