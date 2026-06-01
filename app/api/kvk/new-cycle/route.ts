// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getKvkContext } from '@/lib/kvk'
import { z } from 'zod'

const schema = z.object({ kingdomId: z.string().uuid() })

/**
 * Start a fresh KVK planning cycle (FIX 7). The previous Castle Battle events stay
 * in the database as history (marked completed); a new 'registration' event is
 * created for every participating alliance so attendance/availability are collected
 * fresh. Assignments and attendance from the prior cycle are left intact on the
 * archived events.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kingdomId } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only R5 and system_admin may start a new cycle.
    if (!['r5', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { eventType, alliances } = await getKvkContext(kingdomId)
    if (!eventType) return NextResponse.json({ error: 'KVK event type not configured.' }, { status: 400 })
    if (alliances.length === 0) return NextResponse.json({ error: 'No alliances have KVK enabled.' }, { status: 400 })

    const svc = createServiceClient()

    for (const a of alliances) {
      // Archive any lingering non-completed prior event for this alliance.
      if (a.event && a.event.status !== 'completed') {
        await svc.from('events').update({ status: 'completed' }).eq('id', a.event.id)
      }
      // Create a fresh registration-phase KVK event for the new cycle.
      await svc.from('events').insert({
        alliance_id: a.id,
        event_type_id: eventType.id,
        name: 'KVK Castle Battle',
        status: 'registration',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('KVK new-cycle error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
