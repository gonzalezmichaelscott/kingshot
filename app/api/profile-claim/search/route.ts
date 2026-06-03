// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// FIX 5 — Profile claiming is by Player ID (game_id) ONLY. Governor-name search
// has been removed; we match on an exact numeric game_id within the alliance.
const schema = z.object({
  alliance_id: z.string().uuid(),
  query: z.string().regex(/^\d+$/, 'Player ID must be numeric'),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Exact game_id match within the alliance — no name fallback.
    const { data: member } = await svc
      .from('members')
      .select('id, player_name, game_id, power, alliance_id, linked_user_id, access_token, alliances!members_alliance_id_fkey(name, tag)')
      .eq('alliance_id', body.alliance_id)
      .eq('game_id', body.query.trim())
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ member: null })
    }

    return NextResponse.json({
      member: {
        id: member.id,
        player_name: member.player_name,
        game_id: member.game_id,
        power: member.power,
        alliance: member.alliances,
        already_linked: !!member.linked_user_id,
        has_game_id: !!member.game_id,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
