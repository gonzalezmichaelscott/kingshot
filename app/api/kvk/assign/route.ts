// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getKvkContext, roleForSquad, KVK_STRUCTURES, MANUAL_MARKER } from '@/lib/kvk'
import { z } from 'zod'

const SQUADS = KVK_STRUCTURES.map(s => s.key)

const schema = z.object({
  kingdomId: z.string().uuid(),
  memberId: z.string().uuid(),
  // The structure card the override was made from.
  structure: z.enum(SQUADS as [string, ...string[]]),
  // Position within that structure. Optional for backward compatibility.
  role: z.enum(['rally_leader', 'joiner', 'support']).optional(),
  // Castle only: which rally (1-3). Ignored for turrets/support.
  rallyNumber: z.coerce.number().int().min(1).max(3).optional().default(1),
})

/**
 * Resolve a manual override into a concrete (squad, role, rally_number):
 *  - role "support" always routes the player to the support pool.
 *  - rally_leader / joiner stay on the chosen structure; a castle rally also
 *    carries its rally_number so the card can show the player in that rally.
 */
function resolvePlacement(structure: string, role: string | undefined, rallyNumber: number) {
  if (role === 'support') {
    return { squad: 'support', role: 'support', rally_number: null as number | null }
  }
  const isCastle = structure === 'castle'
  if (role === 'rally_leader') {
    return { squad: structure, role: 'rally_leader', rally_number: isCastle ? rallyNumber : 1 }
  }
  if (role === 'joiner') {
    return { squad: structure, role: 'joiner', rally_number: isCastle ? rallyNumber : 1 }
  }
  // Legacy: no explicit role → reuse the squad's default role, no rally.
  return { squad: structure, role: roleForSquad(structure), rally_number: null }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kingdomId, memberId, structure, role, rallyNumber } = schema.parse(body)
    const placement = resolvePlacement(structure, role, rallyNumber)

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

    // Replace any existing assignment for this member on this event (a player can
    // only hold one position — moving them removes the previous one).
    await svc.from('event_assignments').delete().eq('event_id', eventId).eq('member_id', memberId)
    const rallyLabel = placement.rally_number && placement.squad === 'castle' ? ` (Rally ${placement.rally_number})` : ''
    const { error } = await svc.from('event_assignments').insert({
      event_id: eventId,
      member_id: memberId,
      role: placement.role,
      squad: placement.squad,
      rally_number: placement.rally_number,
      is_primary: true,
      is_backup: false,
      reasoning: `${MANUAL_MARKER} as ${placement.role.replace(/_/g, ' ')}${rallyLabel} on ${placement.squad.replace(/_/g, ' ')} via KVK Command hub.`,
    })
    if (error) throw error

    return NextResponse.json({ ok: true, eventId })
  } catch (error: any) {
    console.error('KVK assign error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
