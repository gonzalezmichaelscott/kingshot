// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBody, chatMessageSchema } from '@/lib/validation'
import { rateLimit, MINUTE_MS } from '@/lib/rate-limit'

// Send an alliance-chat message. Inserts with the user's own (RLS-scoped) client
// so alliance membership is still enforced by the database. Rate limited to 60
// messages per minute per user (Security Fix 2).
export async function POST(request: NextRequest) {
  const { data, response } = await parseBody(request, chatMessageSchema)
  if (response) return response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`chat-send:${user.id}`, 60, MINUTE_MS)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const { data: inserted, error } = await supabase
    .from('chat_messages')
    .insert({ alliance_id: data.allianceId, author_id: user.id, content: data.content })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })

  return NextResponse.json({ message: inserted })
}
