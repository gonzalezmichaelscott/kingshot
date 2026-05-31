// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  access_token: z.string(),
  event_id: z.string().uuid(),
  will_attend: z.boolean(),
  available_from_utc: z.string().nullable().optional(),
  available_to_utc: z.string().nullable().optional(),
  squad_preference: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, event_id, ...fields } = schema.parse(body)

    const supabase = createServiceClient()

    // Resolve member from the access token (so anon users can't write arbitrary rows)
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('access_token', access_token)
      .single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const row = {
      event_id,
      member_id: member.id,
      will_attend: fields.will_attend,
      available_from_utc: fields.available_from_utc || null,
      available_to_utc: fields.available_to_utc || null,
      squad_preference: fields.squad_preference || null,
      notes: fields.notes || null,
      submitted_at: new Date().toISOString(),
    }

    // Find existing row for (event, member) so we don't depend on a DB unique constraint
    const { data: existing } = await supabase
      .from('event_availability')
      .select('id')
      .eq('event_id', event_id)
      .eq('member_id', member.id)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from('event_availability').update(row).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('event_availability').insert(row)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
