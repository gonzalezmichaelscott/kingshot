// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  messageId: z.string().uuid(),
  allianceId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const { messageId, allianceId } = schema.parse(await request.json())

    // Must be an authenticated user.
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Read the authoritative message content and confirm it belongs to the alliance.
    const { data: message } = await svc
      .from('chat_messages')
      .select('id, content, alliance_id')
      .eq('id', messageId)
      .maybeSingle()
    if (!message || message.alliance_id !== allianceId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Caller must be a member of this alliance.
    const { data: profile } = await svc
      .from('user_profiles')
      .select('alliance_id, role')
      .eq('id', user.id)
      .maybeSingle()
    const privileged = ['system_admin', 'kingdom_leader'].includes(profile?.role || '')
    if (!privileged && profile?.alliance_id !== allianceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Match member names that appear as "@<player_name>" in the message.
    const { data: members } = await svc
      .from('members')
      .select('id, player_name')
      .eq('alliance_id', allianceId)

    const content: string = message.content || ''
    const mentionedIds: string[] = []
    for (const m of members || []) {
      if (m.player_name && content.includes(`@${m.player_name}`)) {
        mentionedIds.push(m.id)
      }
    }

    if (mentionedIds.length === 0) return NextResponse.json({ ok: true, mentions: 0 })

    const rows = mentionedIds.map((mid) => ({
      message_id: messageId,
      mentioned_member_id: mid,
      alliance_id: allianceId,
    }))
    const { error } = await svc.from('chat_mentions').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, mentions: rows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
