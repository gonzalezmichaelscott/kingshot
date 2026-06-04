// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({ messageId: z.string().uuid() })

// FIX 4 — delete a Leadership Chat message. Authors may delete their own; a
// System Admin may delete any. Uses the service client so an admin isn't blocked
// by the author-only RLS delete policy.
export async function POST(request: NextRequest) {
  let messageId: string
  try {
    ({ messageId } = schema.parse(await request.json()))
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'system_admin'

  const svc = createServiceClient()
  const { data: message } = await svc
    .from('leadership_chat_messages').select('id, author_id').eq('id', messageId).maybeSingle()
  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  if (!isAdmin && message.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await svc.from('leadership_chat_messages').delete().eq('id', messageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
