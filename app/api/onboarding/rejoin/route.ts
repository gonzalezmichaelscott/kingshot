// @ts-nocheck
/**
 * FIX 4.2 — Re-join an alliance after leaving, WITHOUT re-claiming a profile.
 *
 * A logged-in user who already owns a claimed member record (linked_user_id =
 * auth.uid()) but is not currently in an alliance picks a new alliance. We reuse
 * their EXISTING member record — all stats/heroes/troop data stay intact — by
 * pointing it at the new alliance and reactivating it. No approval required and
 * no new member record is created.
 *
 * Body: { alliance_id: uuid }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  alliance_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Verify the target alliance exists.
    const { data: targetAlliance } = await svc
      .from('alliances')
      .select('id')
      .eq('id', body.alliance_id)
      .maybeSingle()
    if (!targetAlliance) {
      return NextResponse.json({ error: 'Alliance not found.' }, { status: 404 })
    }

    // Find this user's existing claimed member record (most recently updated).
    const { data: members } = await svc
      .from('members')
      .select('id, alliance_id, access_token')
      .eq('linked_user_id', user.id)
      .order('updated_at', { ascending: false })

    const existing = (members || [])[0]
    if (!existing) {
      return NextResponse.json({ error: 'No claimed profile found to move.' }, { status: 400 })
    }

    if (existing.alliance_id === body.alliance_id) {
      return NextResponse.json({ error: 'You are already in that alliance.' }, { status: 400 })
    }

    // Reuse the SAME record: re-point it at the new alliance and reactivate it.
    await svc.from('members').update({
      alliance_id: body.alliance_id,
      is_active: true,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)

    // Point the user's account at the new alliance. Leadership is alliance-
    // specific, so a re-joining player becomes a regular member (r3); platform
    // admins keep their role.
    const { data: profile } = await svc
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    await svc.from('user_profiles').update({
      alliance_id: body.alliance_id,
      role: profile?.role === 'system_admin' ? 'system_admin' : 'r3',
    }).eq('id', user.id)

    return NextResponse.json({ ok: true, access_token: existing.access_token })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
