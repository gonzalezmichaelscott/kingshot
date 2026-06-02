// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isBackendRole } from '@/lib/access'
import { z } from 'zod'

const rowSchema = z.object({
  // game_id (Player ID) is the only required field; player_name is optional and
  // is normally fetched from the game on the client (may be blank on failure).
  game_id: z.string().min(1),
  player_name: z.string().optional().default(''),
  power: z.coerce.number().int().min(0).optional().default(0),
  troop_count: z.coerce.number().int().min(0).optional().default(0),
  march_size: z.coerce.number().int().min(0).optional().default(0),
  rally_capacity: z.coerce.number().int().min(0).optional().default(0),
  timezone: z.string().optional().default('UTC'),
  notes: z.string().optional().default(''),
})

const bodySchema = z.object({
  alliance_id: z.string().uuid(),
  rows: z.array(z.record(z.string())),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())

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
    if (actor?.role !== 'system_admin' && actor?.alliance_id !== body.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceClient()

    // Load existing game_ids in this alliance for duplicate detection (game_id is identity now)
    const { data: existing } = await svc
      .from('members')
      .select('game_id')
      .eq('alliance_id', body.alliance_id)

    const existingIds = new Set(
      (existing || []).filter((m: any) => m.game_id).map((m: any) => String(m.game_id).trim())
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const imported: { player_name: string; game_id: string; self_service_link: string }[] = []
    const skipped: { player_name: string; reason: string }[] = []

    for (const rawRow of body.rows) {
      // Normalize keys to lowercase
      const row: Record<string, string> = {}
      for (const k of Object.keys(rawRow)) {
        row[k.toLowerCase().trim()] = rawRow[k]
      }

      const gameId = (row.game_id || '').trim()
      const name = (row.player_name || '').trim()
      // Label used in skipped-row feedback when there's no name yet.
      const label = name || (gameId ? `Player ID ${gameId}` : '(empty)')

      if (!gameId) {
        skipped.push({ player_name: label, reason: 'game_id (Player ID) is required' })
        continue
      }

      if (existingIds.has(gameId)) {
        skipped.push({ player_name: label, reason: 'Duplicate — Player ID already exists in alliance' })
        continue
      }

      const parsed = rowSchema.safeParse({
        game_id: gameId,
        player_name: name,
        power: row.power || 0,
        troop_count: row.troop_count || 0,
        march_size: row.march_size || 0,
        rally_capacity: row.rally_capacity || 0,
        timezone: row.timezone || 'UTC',
        notes: row.notes || '',
      })

      if (!parsed.success) {
        skipped.push({ player_name: label, reason: parsed.error.issues[0]?.message || 'Invalid data' })
        continue
      }

      const { data: newMember, error } = await svc
        .from('members')
        .insert({
          alliance_id: body.alliance_id,
          // player_name is NOT NULL in the schema — store '' when no name is available yet
          player_name: parsed.data.player_name || '',
          game_id: parsed.data.game_id,
          power: parsed.data.power,
          troop_count: parsed.data.troop_count,
          march_size: parsed.data.march_size,
          rally_capacity: parsed.data.rally_capacity,
          timezone: parsed.data.timezone,
          notes: parsed.data.notes,
        })
        .select('id, access_token')
        .single()

      if (error || !newMember) {
        skipped.push({ player_name: label, reason: error?.message || 'Insert failed' })
        continue
      }

      existingIds.add(gameId)
      imported.push({
        player_name: parsed.data.player_name || '',
        game_id: parsed.data.game_id,
        self_service_link: `${appUrl}/member/${newMember.access_token}`,
      })
    }

    return NextResponse.json({ imported, skipped })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
