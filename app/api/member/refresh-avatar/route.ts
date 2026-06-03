// @ts-nocheck
/**
 * FIX 8 — Force a fresh avatar fetch for a member and update the cache.
 * R4/R5/system_admin only. Bypasses the 14-day cache by always calling the game
 * API and overwriting members.avatar_url / avatar_fetched_at.
 *
 * Body: { member_id: uuid }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isBackendRole } from '@/lib/access'
import { z } from 'zod'

const schema = z.object({
  member_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const { member_id } = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await authed
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!isBackendRole(actor?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()
    const { data: member } = await svc
      .from('members')
      .select('id, game_id, alliance_id')
      .eq('id', member_id)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (actor?.role !== 'system_admin' && member.alliance_id !== actor?.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!member.game_id) {
      return NextResponse.json({ error: 'This member has no Player ID to look up.' }, { status: 400 })
    }

    // Fetch fresh from the game API.
    let avatarUrl = ''
    try {
      const upstream = await fetch(
        `https://kingshot.net/api/player-info?playerId=${encodeURIComponent(member.game_id)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
      )
      if (upstream.status === 429) {
        return NextResponse.json({ error: 'Rate limited — please try again shortly.' }, { status: 429 })
      }
      const json = await upstream.json().catch(() => ({}))
      avatarUrl = (json?.data?.profilePhoto || '').trim()
    } catch {
      return NextResponse.json({ error: 'Failed to reach kingshot.net' }, { status: 502 })
    }

    if (!avatarUrl) {
      return NextResponse.json({ error: 'No avatar found for that Player ID.' }, { status: 404 })
    }

    await svc
      .from('members')
      .update({ avatar_url: avatarUrl, avatar_fetched_at: new Date().toISOString() })
      .eq('id', member.id)

    return NextResponse.json({ ok: true, avatar_url: avatarUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
