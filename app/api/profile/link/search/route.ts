// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// FEATURE 1 — search for an existing member record by in-game Player ID so the
// logged-in user can link it as an additional profile.
const schema = z.object({
  playerId: z.string().regex(/^\d+$/, 'Player ID must be numeric').max(32),
})

export async function POST(request: NextRequest) {
  let playerId: string
  try {
    ({ playerId } = schema.parse(await request.json()))
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const authed = createClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  // All active member records with this game_id (a player may appear in several
  // alliances). Pick the best candidate to claim.
  const { data: members } = await svc
    .from('members')
    .select('id, player_name, game_id, power, avatar_url, alliance_id, linked_user_id, is_active, transferred_to, alliances!members_alliance_id_fkey(name, tag)')
    .eq('game_id', playerId)
    .eq('is_active', true)
    .is('transferred_to', null)

  const active = (members || [])
  if (active.length === 0) {
    return NextResponse.json({ status: 'not_found' })
  }

  // Prefer one already owned by this user, then an unclaimed one, else any.
  const mine = active.find((m: any) => m.linked_user_id === user.id)
  const unclaimed = active.find((m: any) => !m.linked_user_id)
  const chosen = mine || unclaimed || active[0]

  const card = {
    id: chosen.id,
    player_name: chosen.player_name,
    game_id: chosen.game_id,
    power: chosen.power,
    avatar_url: chosen.avatar_url || null,
    alliance: chosen.alliances ? { name: chosen.alliances.name, tag: chosen.alliances.tag } : null,
    has_alliance: !!chosen.alliance_id,
  }

  if (mine) return NextResponse.json({ status: 'already_yours', member: card })
  if (!chosen.linked_user_id) return NextResponse.json({ status: 'available', member: card })
  return NextResponse.json({ status: 'claimed_by_other', member: card })
}
