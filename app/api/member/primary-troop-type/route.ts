// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Update ONLY a member's primary troop type. The full combat-stats route would
// zero out the 12 percentage fields if they aren't all supplied, so quick-edit
// (which only knows the troop type) uses this narrow endpoint instead. Authorized
// by the member's access_token, consistent with /api/member/stats + combat-stats.
const schema = z.object({
  access_token: z.string().min(10).max(100),
  troop_type_primary: z.enum(['infantry', 'cavalry', 'archer', 'mixed']),
})

export async function POST(request: NextRequest) {
  try {
    const { access_token, troop_type_primary } = schema.parse(await request.json())

    const supabase = createServiceClient()
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('access_token', access_token)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Find-then-update/insert (no reliance on a member_id unique constraint),
    // matching the pattern in /api/member/combat-stats.
    const { data: existing } = await supabase
      .from('member_combat_stats')
      .select('id')
      .eq('member_id', member.id)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('member_combat_stats')
        .update({ troop_type_primary, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('member_combat_stats')
        .insert({ member_id: member.id, troop_type_primary })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
