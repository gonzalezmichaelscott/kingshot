// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  assignTriAllianceRoles,
  generateRoleInstructionTemplates,
  applyInstructionTemplate,
} from '@/lib/tri-alliance-planner'

const schema = z.object({
  eventId: z.string().uuid(),
  legionNumber: z.union([z.literal(1), z.literal(2)]),
  commanderIds: z.array(z.string().uuid()).max(2).default([]),
})

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const { eventId, legionNumber, commanderIds } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events')
      .select('id, alliance_id, event_types(slug)')
      .eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (event.event_types?.slug !== 'tri_alliance_clash') {
      return NextResponse.json({ error: 'Not a Tri-Alliance Clash event' }, { status: 400 })
    }

    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Attending members who voted for this legion.
    const { data: availability } = await svc.from('event_availability')
      .select('member_id, members(id, player_name, power)')
      .eq('event_id', eventId)
      .eq('will_attend', true)
      .eq('squad_preference', `legion${legionNumber}`)

    const attending = (availability || [])
      .filter(a => a.members)
      .map(a => ({ id: a.members.id, player_name: a.members.player_name, power: a.members.power || 0 }))

    if (attending.length < 15) {
      return NextResponse.json(
        { error: `Legion ${legionNumber} needs at least 15 attending members (has ${attending.length}).` },
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

    // Phase 1 — deterministic role assignment.
    const assignments = assignTriAllianceRoles(inputs, commanderIds, legionNumber)

    // Phase 2 — AI instruction templates, one call per role type present.
    const templates = await generateRoleInstructionTemplates(assignments.map(a => a.role), legionNumber)

    // Phase 3 — store. Clear this legion's previous plan plus any stale rows for
    // these members (a member may have switched legions since the last run).
    await svc.from('tri_alliance_assignments').delete().eq('event_id', eventId).eq('legion', legionNumber)
    await svc.from('tri_alliance_assignments').delete().eq('event_id', eventId).in('member_id', memberIds)

    const rows = assignments.map(a => ({
      event_id: eventId,
      member_id: a.member_id,
      legion: a.legion,
      role: a.role,
      assigned_to: a.assigned_to,
      reaction_team_letter: a.reaction_team_letter,
      formation: a.formation,
      hero_squad_1: a.hero_squad_1,
      hero_squad_2: a.hero_squad_2,
      hero_squad_3: a.hero_squad_3,
      hero_recommendation: a.hero_recommendation,
      stage_instructions: applyInstructionTemplate(templates[a.role] || '', a),
      power_rank: a.power_rank,
    }))
    const { error: insertError } = await svc.from('tri_alliance_assignments').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ ok: true, legion: legionNumber, assignments })
  } catch (error: any) {
    console.error('[TriAlliancePlan] generate failed:', error?.message || error)
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
