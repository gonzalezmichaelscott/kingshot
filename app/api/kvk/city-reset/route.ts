// @ts-nocheck
// FEATURE 3 — re-run the auto-population of city slots from the current battle plan.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoPopulateCityAssignments } from '@/lib/kvk-city'
import { z } from 'zod'

const MANAGE_ROLES = ['r4', 'r5', 'kingdom_leader', 'system_admin']
const schema = z.object({ kingdomId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const { kingdomId } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!MANAGE_ROLES.includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await autoPopulateCityAssignments(kingdomId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('KVK city-reset error:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
