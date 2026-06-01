// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  allianceId: z.string().uuid(),
  enabled: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { allianceId, enabled } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role || ''
    // Only R5 and system_admin may toggle KVK participation.
    const isAdmin = role === 'system_admin'
    if (!isAdmin && !(role === 'r5' && profile?.alliance_id === allianceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // alliances RLS only lets system_admin/kingdom_leader write, so use the
    // service client after verifying the actor above.
    const svc = createServiceClient()
    const { error } = await svc
      .from('alliances')
      .update({ kvk_enabled: enabled })
      .eq('id', allianceId)
    if (error) throw error

    return NextResponse.json({ kvk_enabled: enabled })
  } catch (error: any) {
    console.error('KVK toggle error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
