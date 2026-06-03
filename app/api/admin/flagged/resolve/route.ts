// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/validation'
import { z } from 'zod'

const schema = z.object({
  messageId: z.string().uuid(),
  action: z.enum(['delete', 'dismiss']),
})

// System Admin resolves a flagged World Chat message: either delete the message
// (and mark its reports reviewed) or dismiss the reports (keep the message).
export async function POST(request: NextRequest) {
  const { data, response } = await parseBody(request, schema)
  if (response) return response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()

  if (data.action === 'delete') {
    await svc.from('world_chat_messages').delete().eq('id', data.messageId)
    await svc.from('report_flags')
      .update({ status: 'reviewed' }).eq('message_id', data.messageId).eq('status', 'pending')
  } else {
    await svc.from('report_flags')
      .update({ status: 'dismissed' }).eq('message_id', data.messageId).eq('status', 'pending')
  }

  return NextResponse.json({ ok: true })
}
