// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const num = z.number().min(0).optional().default(0)

const schema = z.object({
  access_token: z.string(),
  infantry_attack: num, infantry_defense: num, infantry_health: num, infantry_lethality: num,
  cavalry_attack: num, cavalry_defense: num, cavalry_health: num, cavalry_lethality: num,
  archer_attack: num, archer_defense: num, archer_health: num, archer_lethality: num,
  troop_type_primary: z.enum(['infantry', 'cavalry', 'archer', 'mixed']).optional().default('infantry'),
  source: z.enum(['manual', 'ocr_verified']).optional().default('manual'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, ...stats } = schema.parse(body)

    const supabase = createServiceClient()
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('access_token', access_token)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Find-then-update/insert (no reliance on a member_id unique constraint)
    const { data: existing } = await supabase
      .from('member_combat_stats')
      .select('id')
      .eq('member_id', member.id)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('member_combat_stats')
        .update({ ...stats, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('member_combat_stats')
        .insert({ ...stats, member_id: member.id })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
