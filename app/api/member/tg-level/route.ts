// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Update ONLY a member's TrueGold level. TG is a global multiplier (0-10) that
// applies to ALL troop types, stored as troop_data[type].tg_level. We merge it into
// the existing troop_data so tier counts (and troop_count) are preserved — unlike
// the full /api/member/stats route which recomputes troop_count from troop_data.
// Authorized by the member's access_token, consistent with the other member routes.
const TROOP_TYPES = ['infantry', 'cavalry', 'archer'] as const

const schema = z.object({
  access_token: z.string().min(10).max(100),
  tg_level: z.number().int().min(0).max(10),
})

export async function POST(request: NextRequest) {
  try {
    const { access_token, tg_level } = schema.parse(await request.json())

    const supabase = createServiceClient()
    const { data: member } = await supabase
      .from('members')
      .select('id, troop_data')
      .eq('access_token', access_token)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Merge tg_level into each troop type, preserving any existing tier counts.
    const existing = member.troop_data && typeof member.troop_data === 'object' ? member.troop_data : {}
    const troop_data: Record<string, any> = { ...existing }
    for (const type of TROOP_TYPES) {
      troop_data[type] = { ...(troop_data[type] && typeof troop_data[type] === 'object' ? troop_data[type] : {}), tg_level }
    }

    const { error } = await supabase
      .from('members')
      .update({ troop_data, updated_at: new Date().toISOString() })
      .eq('id', member.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
