// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  event_id: z.string().uuid(),
})

// Permanently deletes an event. Availability and assignment rows are removed
// via ON DELETE CASCADE on their event_id foreign keys.
export async function POST(request: NextRequest) {
  try {
    const { event_id } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: actor } = await authed.from('user_profiles').select('role, alliance_id').eq('id', user.id).single()

    const svc = createServiceClient()
    const { data: event } = await svc.from('events').select('id, alliance_id').eq('id', event_id).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    // Permission: System Admin deletes any event; R4/R5 only their own alliance's.
    const isAdmin = actor?.role === 'system_admin'
    const isLeader = ['r4', 'r5'].includes(actor?.role || '') && actor?.alliance_id === event.alliance_id
    if (!isAdmin && !isLeader) {
      return NextResponse.json({ error: "You don't have permission to delete this event" }, { status: 403 })
    }

    const { error } = await svc.from('events').delete().eq('id', event_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
