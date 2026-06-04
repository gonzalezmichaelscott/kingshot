// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, MINUTE_MS } from '@/lib/rate-limit'
import { z } from 'zod'

// FIX 4 — send a Leadership Chat message. The message is inserted with the
// user's own (RLS-scoped) client, so the database policy enforces that the
// author is an R4/R5/system_admin belonging to the target kingdom. The route
// only needs to confirm the kingdom matches the sender before inserting.
const schema = z.object({
  content: z.string().min(1).max(2000),
  kingdomId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await request.json())
  } catch (e: any) {
    return NextResponse.json({ error: e?.issues?.[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`leadership-chat-send:${user.id}`, 60, MINUTE_MS)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  // Insert via the RLS-scoped client: the policy validates role + kingdom.
  const { data: inserted, error } = await supabase
    .from('leadership_chat_messages')
    .insert({ kingdom_id: body.kingdomId, author_id: user.id, content: body.content })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Not authorized for this kingdom’s leadership chat.' }, { status: 403 })

  return NextResponse.json({ message: inserted })
}
