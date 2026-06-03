// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/validation'
import { rateLimit, HOUR_MS } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  messageId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

// Report a World Chat message. Inserted with the user's RLS-scoped client so the
// policy enforces reported_by = auth.uid(). A unique (message_id, reported_by)
// index means a second report from the same user is a harmless no-op.
export async function POST(request: NextRequest) {
  const { data, response } = await parseBody(request, schema)
  if (response) return response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Light abuse cap: 20 reports per hour per user.
  const rl = rateLimit(`report:${user.id}`, 20, HOUR_MS)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { error } = await supabase.from('report_flags').insert({
    message_id: data.messageId,
    message_type: 'world_chat',
    reported_by: user.id,
    reason: data.reason || null,
    status: 'pending',
  })

  // 23505 = unique violation (already reported by this user) — treat as success.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
