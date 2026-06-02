// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: z.enum(['attending', 'not_attending', 'no_response']),
  available_from_utc: z.string().nullable().optional(),
  available_to_utc: z.string().nullable().optional(),
})

// POST /api/kvk/attendance
// R4/R5/system_admin set a member's attendance + availability on their behalf
// for a KVK (or any) event. Stamps manually_set_by with the leader's user id.
export async function POST(request: NextRequest) {
  try {
    const { event_id, member_id, status, available_from_utc, available_to_utc } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = createServiceClient()

    // The event and member must belong to the leader's alliance (admins bypass).
    const { data: event } = await service.from('events').select('id, alliance_id').eq('id', event_id).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const { data: member } = await service.from('members').select('id, alliance_id').eq('id', member_id).single()
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    if (profile.role !== 'system_admin') {
      if (event.alliance_id !== profile.alliance_id || member.alliance_id !== profile.alliance_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Find any existing availability row for (event, member).
    const { data: existing } = await service
      .from('event_availability')
      .select('id')
      .eq('event_id', event_id)
      .eq('member_id', member_id)
      .maybeSingle()

    // "No response" — remove the row entirely.
    if (status === 'no_response') {
      if (existing?.id) await service.from('event_availability').delete().eq('id', existing.id)
      return NextResponse.json({ ok: true })
    }

    const willAttend = status === 'attending'
    const row = {
      event_id,
      member_id,
      will_attend: willAttend,
      available_from_utc: willAttend ? (available_from_utc || null) : null,
      available_to_utc: willAttend ? (available_to_utc || null) : null,
      manually_set_by: user.id,
      submitted_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await service.from('event_availability').update(row).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await service.from('event_availability').insert(row)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
  }
}
