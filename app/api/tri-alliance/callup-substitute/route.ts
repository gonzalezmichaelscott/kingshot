// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  generateRoleInstructionTemplate,
  applyInstructionTemplate,
  TRI_FORMATIONS,
} from '@/lib/tri-alliance-planner'

const schema = z.object({
  eventId: z.string().uuid(),
  absentMemberId: z.string().uuid(),
  substituteMemberId: z.string().uuid(),
})

export const maxDuration = 60

// Swaps a substitute into an absent combatant's role. The substitute inherits the
// absent member's role, pairing, team letter, formation and power rank, and gets
// freshly generated instructions; the absent member becomes a substitute.
export async function POST(request: NextRequest) {
  try {
    const { eventId, absentMemberId, substituteMemberId } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events').select('id, alliance_id').eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Two FKs to members (member_id + assigned_to) — bare members(...) embed is
    // ambiguous (PGRST201) and would null the whole query. Use the explicit FK.
    const { data: rowsData } = await svc.from('tri_alliance_assignments')
      .select('*, members!tri_alliance_assignments_member_id_fkey(player_name)')
      .eq('event_id', eventId)
      .in('member_id', [absentMemberId, substituteMemberId])
    const absent = (rowsData || []).find(r => r.member_id === absentMemberId)
    const sub = (rowsData || []).find(r => r.member_id === substituteMemberId)

    if (!absent) return NextResponse.json({ error: 'Absent member has no assignment in this plan' }, { status: 404 })
    if (!sub) return NextResponse.json({ error: 'Substitute has no assignment in this plan' }, { status: 404 })
    if (sub.role !== 'substitute') return NextResponse.json({ error: 'Selected member is not a substitute' }, { status: 400 })
    if (absent.role === 'substitute') return NextResponse.json({ error: 'Absent member is already a substitute' }, { status: 400 })

    // Resolve the assigned Main Player's name for supporter instructions.
    let assignedToName: string | null = null
    if (absent.assigned_to) {
      const { data: mp } = await svc.from('members').select('player_name').eq('id', absent.assigned_to).single()
      assignedToName = mp?.player_name || null
    }

    // Regenerate instructions for the substitute's new role (one AI call) and a
    // fresh substitute template for the benched member (one AI call).
    const [roleTemplate, subTemplate] = await Promise.all([
      generateRoleInstructionTemplate(absent.role, absent.legion),
      generateRoleInstructionTemplate('substitute', absent.legion),
    ])

    const newRoleInstructions = applyInstructionTemplate(roleTemplate, {
      assigned_to_name: assignedToName,
      reaction_team_letter: absent.reaction_team_letter,
    })

    // Substitute steps into the role (keeps their own hero squads).
    const { error: e1 } = await svc.from('tri_alliance_assignments').update({
      role: absent.role,
      assigned_to: absent.assigned_to,
      reaction_team_letter: absent.reaction_team_letter,
      formation: absent.formation,
      power_rank: absent.power_rank,
      stage_instructions: newRoleInstructions,
    }).eq('id', sub.id)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    // Absent member drops to substitute.
    const { error: e2 } = await svc.from('tri_alliance_assignments').update({
      role: 'substitute',
      assigned_to: null,
      reaction_team_letter: null,
      formation: TRI_FORMATIONS.substitute,
      power_rank: null,
      stage_instructions: subTemplate,
    }).eq('id', absent.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[TriAlliancePlan] callup failed:', error?.message || error)
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
