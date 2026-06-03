// @ts-nocheck
/**
 * Rename an alliance — change ONLY its display name and tag. R5 (of this
 * alliance) or system_admin only. No other columns, tokens, member records or
 * self-service links are touched, so all existing URLs/associations stay intact.
 *
 * PATCH body: { allianceId: uuid, name: string, tag: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  allianceId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or fewer'),
  // Tag: letters/numbers only, max 5, stored uppercase.
  tag: z.string().trim().min(1, 'Tag is required').max(5, 'Tag must be 5 characters or fewer')
    .regex(/^[A-Za-z0-9]+$/, 'Tag must be letters and numbers only'),
})

export async function PATCH(request: NextRequest) {
  try {
    const { allianceId, name, tag } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role || ''
    const isAdmin = role === 'system_admin'
    // R5 may rename only their own alliance; system_admin may rename any.
    if (!isAdmin && !(role === 'r5' && profile?.alliance_id === allianceId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // alliances RLS only permits system_admin/kingdom_leader writes, so use the
    // service client after verifying the actor above. Update ONLY name + tag.
    const svc = createServiceClient()
    const { data: updated, error } = await svc
      .from('alliances')
      .update({ name: name.trim(), tag: tag.trim().toUpperCase() })
      .eq('id', allianceId)
      .select('id, name, tag')
      .single()
    if (error) throw error

    return NextResponse.json({ alliance: updated })
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input' }, { status: 400 })
    }
    console.error('Alliance rename error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
