// @ts-nocheck
/**
 * FIX 8 — Persist a fetched player avatar URL onto the member record so future
 * page loads read it from the DB instead of calling the kingshot.net API.
 *
 * Called by the PlayerAvatar component after it fetches an avatar from
 * /api/player-lookup. Public (the self-service page is unauthenticated), so it
 * only ever writes the two avatar columns and validates the URL.
 *
 * Body: { game_id: string, avatar_url: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  game_id: z.string().regex(/^\d{1,32}$/),
  avatar_url: z.string().url().max(2000),
})

export async function POST(request: NextRequest) {
  try {
    const { game_id, avatar_url } = schema.parse(await request.json())

    // Only accept https URLs (avatars are served over https by the game CDN).
    if (!avatar_url.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 })
    }

    const svc = createServiceClient()
    await svc
      .from('members')
      .update({ avatar_url, avatar_fetched_at: new Date().toISOString() })
      .eq('game_id', game_id)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
