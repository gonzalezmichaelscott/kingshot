// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/validation'
import { z } from 'zod'

const schema = z.object({ messageId: z.string().uuid() })

// Moderation delete for World Chat: System Admin and R5 may delete ANY message;
// authors may delete their own. Uses the service client so moderators aren't
// blocked by the author-only RLS delete policy.
export async function POST(request: NextRequest) {
  const { data, response } = await parseBody(request, schema)
  if (response) return response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  const isModerator = ['system_admin', 'r5'].includes(profile?.role || '')

  const svc = createServiceClient()
  const { data: message } = await svc
    .from('world_chat_messages').select('id, author_id').eq('id', data.messageId).maybeSingle()
  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  if (!isModerator && message.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await svc.from('world_chat_messages').delete().eq('id', data.messageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve any open reports on this message.
  await svc.from('report_flags')
    .update({ status: 'reviewed' })
    .eq('message_id', data.messageId)
    .eq('status', 'pending')

  return NextResponse.json({ ok: true })
}
