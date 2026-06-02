// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  event_id: z.string().uuid(),
  name: z.string().nullable().optional(),
  battle_start_utc: z.string().nullable().optional(),
  battle_end_utc: z.string().nullable().optional(),
  legion1_start_utc: z.string().nullable().optional(),
  legion2_start_utc: z.string().nullable().optional(),
  status: z.enum(['planning', 'registration', 'active', 'completed']).optional(),
  notes: z.string().nullable().optional(),
})

const TIMESTAMP_FIELDS = ['battle_start_utc', 'battle_end_utc', 'legion1_start_utc', 'legion2_start_utc']

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())
    const { event_id, ...fields } = body

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events').select('id, alliance_id').eq('id', event_id).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    // Permission: System Admin edits any event; R4/R5 only their own alliance's.
    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) {
      return NextResponse.json({ error: "You don't have permission to edit this event" }, { status: 403 })
    }

    // Build the update from only the fields that were actually provided.
    const updates: Record<string, any> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue
      // Empty datetime strings clear the column.
      if (TIMESTAMP_FIELDS.includes(key)) {
        updates[key] = value === '' ? null : value
      } else if (key === 'name') {
        updates[key] = value === '' ? null : value
      } else {
        updates[key] = value
      }
    }
    // Keep battle_start_utc and Legion 1 in sync for Swordland back-compat.
    if (updates.legion1_start_utc !== undefined) {
      updates.battle_start_utc = updates.legion1_start_utc
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

    const { error } = await svc.from('events').update(updates).eq('id', event_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
