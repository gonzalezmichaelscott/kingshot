// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  access_token: z.string(),
  hero_id: z.string().uuid(),
  star_level: z.number().int().min(0).max(5),
  hero_level: z.number().int().min(1).max(60),
  is_primary: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, ...heroData } = schema.parse(body)

    const supabase = createServiceClient()

    // Resolve member_id from access_token
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id')
      .eq('access_token', access_token)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('member_heroes')
      .upsert(
        { member_id: member.id, ...heroData },
        { onConflict: 'member_id,hero_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
