// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  assignSwordlandRoles,
  generateTeamInstructionTemplates,
} from '@/lib/swordland-planner'

const schema = z.object({
  eventId: z.string().uuid(),
  legionNumber: z.union([z.literal(1), z.literal(2)]),
})

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { eventId, legionNumber } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events')
      .select('id, alliance_id, event_types(slug)')
      .eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (event.event_types?.slug !== 'swordland_showdown') {
      return NextResponse.json({ error: 'Not a Swordland Showdown event' }, { status: 400 })
    }

    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Attending members for THIS legion. Members with no chosen legion fold into
    // Legion 1 (matches the legion board's split), so they still get assigned.
    const { data: availability } = await svc.from('event_availability')
      .select('member_id, squad_preference, members(id, player_name, power)')
      .eq('event_id', eventId)
      .eq('will_attend', true)

    const attending = (availability || [])
      .filter(a => a.members)
      .filter(a => legionNumber === 1
        ? a.squad_preference !== 'legion2'
        : a.squad_preference === 'legion2')
      .map(a => ({ id: a.members.id, player_name: a.members.player_name, power: a.members.power || 0 }))

    if (attending.length === 0) {
      return NextResponse.json(
        { error: `Legion ${legionNumber} has no attending members.` },
        { status: 400 }
      )
    }

    // Hero data for squad recommendations.
    const memberIds = attending.map(m => m.id)
    const { data: heroRows } = await svc.from('member_heroes')
      .select('member_id, star_level, heroes(name, generation, rarity, troop_type, is_economy_hero)')
      .in('member_id', memberIds)
    const heroesByMember = new Map<string, any[]>()
    for (const row of heroRows || []) {
      if (!heroesByMember.has(row.member_id)) heroesByMember.set(row.member_id, [])
      heroesByMember.get(row.member_id).push(row)
    }
    const inputs = attending.map(m => ({ ...m, heroes: heroesByMember.get(m.id) || [] }))

    // Phase 1 — deterministic team assignment.
    const assignments = assignSwordlandRoles(inputs, legionNumber)

    // Phase 2 — AI instruction templates, one call per team type present.
    const templates = await generateTeamInstructionTemplates(assignments.map(a => a.team), legionNumber)

    // Phase 3 — store. Clear this legion's previous plan plus any stale rows for
    // these members (a member may have switched legions since the last run). The
    // OTHER legion's plan is left completely untouched.
    await svc.from('swordland_assignments').delete().eq('event_id', eventId).eq('legion', legionNumber)
    await svc.from('swordland_assignments').delete().eq('event_id', eventId).in('member_id', memberIds)

    const rows = assignments.map(a => ({
      event_id: eventId,
      member_id: a.member_id,
      legion: a.legion,
      team: a.team,
      building_targets: a.building_targets,
      stage_instructions: templates[a.team] || null,
      hero_recommendation: a.hero_recommendation,
      hero_squad_1: a.hero_squad_1,
      hero_squad_2: a.hero_squad_2,
      hero_squad_3: a.hero_squad_3,
      power_rank: a.power_rank,
    }))
    const { error: insertError } = await svc.from('swordland_assignments').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ ok: true, legion: legionNumber, assignments })
  } catch (error: any) {
    console.error('[SwordlandPlan] generate failed:', error?.message || error)
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
