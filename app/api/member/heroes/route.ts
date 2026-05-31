// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const upsertSchema = z.object({
  access_token: z.string(),
  hero_id: z.string().uuid(),
  hero_level: z.number().int().min(1).max(80),
  star_level: z.number().int().min(0).max(5),
  star_shards: z.number().int().min(0).max(6).optional().default(0),
  widget_unlocked: z.boolean().optional().default(false),
  widget_level: z.number().int().min(0).max(10).optional().default(0),
  expedition_skill_levels: z.record(z.string(), z.number().int().min(0).max(5)).optional().default({}),
  is_primary: z.boolean().optional().default(false),
})

async function resolveMemberId(supabase: any, accessToken: string): Promise<string | null> {
  const { data } = await supabase.from('members').select('id').eq('access_token', accessToken).single()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, ...heroData } = upsertSchema.parse(body)

    const supabase = createServiceClient()
    const memberId = await resolveMemberId(supabase, access_token)
    if (!memberId) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Find existing row for this (member, hero) so we don't depend on a DB
    // unique constraint for upsert onConflict.
    const { data: existing } = await supabase
      .from('member_heroes')
      .select('id')
      .eq('member_id', memberId)
      .eq('hero_id', heroData.hero_id)
      .maybeSingle()

    const row = { member_id: memberId, ...heroData, updated_at: new Date().toISOString() }

    if (existing?.id) {
      const { error } = await supabase.from('member_heroes').update(row).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('member_heroes').insert(row)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}

const deleteSchema = z.object({
  access_token: z.string(),
  member_hero_id: z.string().uuid(),
})

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, member_hero_id } = deleteSchema.parse(body)

    const supabase = createServiceClient()
    const memberId = await resolveMemberId(supabase, access_token)
    if (!memberId) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Scope the delete to this member so a token can't remove another member's hero
    const { error } = await supabase
      .from('member_heroes')
      .delete()
      .eq('id', member_hero_id)
      .eq('member_id', memberId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
