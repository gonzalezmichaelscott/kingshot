// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Parse @mentions in a world-chat message and drop a notification (type 'mention')
// for each mentioned user. World chat is global, so any user can be mentioned.

const schema = z.object({
  messageId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const { messageId } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    const { data: message } = await svc
      .from('world_chat_messages')
      .select('id, content, author_id')
      .eq('id', messageId)
      .maybeSingle()
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    // Only the author may trigger notifications for their own message.
    if (message.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build name -> userIds. Game tag (player_name) wins; display_name is a fallback,
    // matching how names are shown in world chat.
    const [{ data: members }, { data: profiles }] = await Promise.all([
      svc.from('members').select('player_name, linked_user_id').not('linked_user_id', 'is', null),
      svc.from('user_profiles').select('id, display_name'),
    ])

    const usersByName = new Map<string, Set<string>>()
    const nameByUser = new Map<string, string>()
    const addName = (name: string | null, uid: string | null) => {
      if (!name || !uid) return
      if (!usersByName.has(name)) usersByName.set(name, new Set())
      usersByName.get(name)!.add(uid)
    }
    for (const m of members || []) {
      addName(m.player_name, m.linked_user_id)
      if (m.player_name && m.linked_user_id) nameByUser.set(m.linked_user_id, m.player_name)
    }
    for (const p of profiles || []) {
      addName(p.display_name, p.id)
      if (!nameByUser.has(p.id) && p.display_name) nameByUser.set(p.id, p.display_name)
    }

    const content: string = message.content || ''
    const mentionedUserIds = new Set<string>()
    // Longest names first so "@Idaho Potato" wins over "@Idaho".
    const names = [...usersByName.keys()].sort((a, b) => b.length - a.length)
    for (const name of names) {
      if (content.includes(`@${name}`)) {
        for (const uid of usersByName.get(name)!) {
          if (uid !== message.author_id) mentionedUserIds.add(uid)
        }
      }
    }

    if (mentionedUserIds.size === 0) return NextResponse.json({ ok: true, mentions: 0 })

    const senderName = nameByUser.get(message.author_id) || 'Someone'
    const rows = [...mentionedUserIds].map((uid) => ({
      user_id: uid,
      type: 'mention',
      title: `${senderName} mentioned you in World Chat`,
      message: content.slice(0, 60),
      link: '/world-chat',
      related_id: messageId,
    }))
    const { error } = await svc.from('notifications').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, mentions: rows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
