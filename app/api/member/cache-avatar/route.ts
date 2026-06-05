// @ts-nocheck
/**
 * FIX 8 — Persist a fetched player avatar URL onto the member record so future
 * page loads read it from the DB instead of calling the kingshot.net API.
 *
 * Called by the PlayerAvatar component after it fetches an avatar from
 * /api/player-lookup. Public (the self-service page is unauthenticated), so it
 * only ever writes the two avatar columns and validates the URL.
 *
 * Body: { avatar_url: string, member_id?: uuid, access_token?: string, game_id?: string }
 *
 * FIX 4 — profile-aware. The cache write targets the ONE specific member record
 * the avatar belongs to (by member_id or self-service access_token). It must NOT
 * fan out across every member sharing a game_id — that copied one profile's
 * avatar onto unrelated records (alts / other alliances).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  avatar_url: z.string().url().max(2000),
  member_id: z.string().uuid().optional(),
  access_token: z.string().min(10).max(100).optional(),
  // game_id is accepted for validation/back-compat but is NEVER used as the sole
  // update key (that is what caused the cross-profile corruption).
  game_id: z.string().regex(/^\d{1,32}$/).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { avatar_url, member_id, access_token, game_id } = schema.parse(await request.json())

    // Only accept https URLs (avatars are served over https by the game CDN).
    if (!avatar_url.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 })
    }

    // Require a record-specific identifier. Without one we cannot safely target a
    // single member, so we no-op rather than risk overwriting other profiles.
    if (!member_id && !access_token) {
      return NextResponse.json({ ok: true, skipped: 'no record identifier' })
    }

    const svc = createServiceClient()
    let query = svc
      .from('members')
      .update({ avatar_url, avatar_fetched_at: new Date().toISOString() })
    if (member_id) {
      query = query.eq('id', member_id)
    } else {
      query = query.eq('access_token', access_token)
    }
    // Extra guard: if a game_id was supplied, only write when it matches the
    // target record, so a stale client can never stamp the wrong avatar.
    if (game_id) query = query.eq('game_id', game_id)

    await query

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
