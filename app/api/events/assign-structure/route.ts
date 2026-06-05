// @ts-nocheck
// Manual structure override for a SINGLE event (e.g. a Castle Battle event page).
// Unlike /api/kvk/assign (which resolves each member's own alliance KVK event by
// kingdom), this writes the assignment directly to the given event after checking
// the actor manages that event's alliance.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MANUAL_MARKER } from '@/lib/kvk'
import { z } from 'zod'

const STRUCTURES = ['castle', 'north_turret', 'east_turret', 'south_turret', 'west_turret', 'support'] as const

const schema = z.object({
  eventId: z.string().uuid(),
  memberId: z.string().uuid(),
  structure: z.enum(STRUCTURES),
  role: z.enum(['rally_leader', 'joiner', 'support']).optional(),
  rallyNumber: z.coerce.number().int().min(1).max(3).optional().default(1),
})

function resolvePlacement(structure: string, role: string | undefined, rallyNumber: number) {
  if (role === 'support') return { squad: 'support', role: 'support', rally_number: null as number | null }
  const isCastle = structure === 'castle'
  if (role === 'rally_leader') return { squad: structure, role: 'rally_leader', rally_number: isCastle ? rallyNumber : 1 }
  if (role === 'joiner') return { squad: structure, role: 'joiner', rally_number: isCastle ? rallyNumber : 1 }
  return { squad: structure, role: structure === 'castle' ? 'castle' : structure.includes('turret') ? 'turret_joiner' : 'support', rally_number: null }
}

export async function POST(request: NextRequest) {
  try {
    const { eventId, memberId, structure, role, rallyNumber } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('role, alliance_id').eq('id', user.id).single()
    if (!['r4', 'r5', 'kingdom_leader', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()
    const { data: event } = await svc.from('events').select('id, alliance_id').eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    const { data: member } = await svc.from('members').select('id, alliance_id').eq('id', memberId).single()
    if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 400 })

    const isAdmin = ['system_admin', 'kingdom_leader'].includes(profile?.role || '')
    if (!isAdmin && (event.alliance_id !== profile?.alliance_id || member.alliance_id !== profile?.alliance_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const placement = resolvePlacement(structure, role, rallyNumber)
    const rallyLabel = placement.rally_number && placement.squad === 'castle' ? ` (Rally ${placement.rally_number})` : ''

    // One position per player — remove any previous assignment on this event.
    await svc.from('event_assignments').delete().eq('event_id', eventId).eq('member_id', memberId)
    const { error } = await svc.from('event_assignments').insert({
      event_id: eventId,
      member_id: memberId,
      role: placement.role,
      squad: placement.squad,
      rally_number: placement.rally_number,
      is_primary: true,
      is_backup: false,
      reasoning: `${MANUAL_MARKER} as ${placement.role.replace(/_/g, ' ')}${rallyLabel} on ${placement.squad.replace(/_/g, ' ')}.`,
    })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('assign-structure error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
