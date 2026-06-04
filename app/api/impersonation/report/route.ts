// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, HOUR_MS } from '@/lib/rate-limit'
import { z } from 'zod'

// FEATURE 2 — public impersonation report submission (no login required).
const schema = z.object({
  reporter_email: z.string().email().max(200),
  claimed_player_id: z.string().regex(/^\d+$/, 'Player ID must be numeric').max(32),
  claimed_player_name: z.string().max(120).optional().default(''),
  description: z.string().min(10, 'Please describe the situation').max(4000),
})

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message || 'Invalid request' }, { status: 400 })
  }

  // Abuse guard — cap submissions per IP/email window.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  const rl = rateLimit(`impersonation-report:${ip}:${body.reporter_email}`, 5, HOUR_MS)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many reports — please try again later.' }, { status: 429 })
  }

  // Capture the reporter's user id if they happen to be logged in (optional).
  let reporterUserId: string | null = null
  try {
    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    reporterUserId = user?.id || null
  } catch { /* anonymous */ }

  const svc = createServiceClient()

  // Best-effort: link the report to the suspected member record by Player ID.
  const { data: suspect } = await svc
    .from('members')
    .select('id')
    .eq('game_id', body.claimed_player_id)
    .eq('is_active', true)
    .is('transferred_to', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await svc.from('impersonation_reports').insert({
    reporter_user_id: reporterUserId,
    reporter_email: body.reporter_email.trim(),
    claimed_player_id: body.claimed_player_id,
    claimed_player_name: body.claimed_player_name?.trim() || null,
    suspected_member_id: suspect?.id || null,
    description: body.description.trim(),
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
