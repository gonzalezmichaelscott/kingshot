// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  alliance_id: z.string().uuid(),
  query: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Try matching by game_id first (exact), then by player_name (case-insensitive partial)
    const isNumeric = /^\d+$/.test(body.query.trim())

    let member: any = null

    if (isNumeric) {
      const { data } = await svc
        .from('members')
        .select('id, player_name, game_id, power, alliance_id, linked_user_id, access_token, alliances(name, tag)')
        .eq('alliance_id', body.alliance_id)
        .eq('game_id', body.query.trim())
        .maybeSingle()
      member = data
    }

    if (!member) {
      const { data } = await svc
        .from('members')
        .select('id, player_name, game_id, power, alliance_id, linked_user_id, access_token, alliances(name, tag)')
        .eq('alliance_id', body.alliance_id)
        .ilike('player_name', `%${body.query.trim()}%`)
        .maybeSingle()
      member = data
    }

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
