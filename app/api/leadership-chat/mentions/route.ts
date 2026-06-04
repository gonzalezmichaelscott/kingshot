// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

// FIX 4 — parse @mentions in a leadership-chat message and notify each mentioned
// R4/R5/system_admin in the same kingdom. Only the author may trigger this.
const schema = z.object({ messageId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const { messageId } = schema.parse(await request.json())

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const { data: message } = await svc
      .from('leadership_chat_messages')
      .select('id, content, author_id, kingdom_id')
      .eq('id', messageId)
      .maybeSingle()
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    if (message.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Leadership profiles in this kingdom = the only valid mention targets.
    const { data: alliances } = await svc.from('alliances').select('id').eq('kingdom_id', message.kingdom_id)
    const allianceIds = (alliances || []).map((a: any) => a.id)
    if (allianceIds.length === 0) return NextResponse.json({ ok: true, mentions: 0 })

    const [{ data: leaders }, { data: members }] = await Promise.all([
      svc.from('user_profiles').select('id, display_name').in('alliance_id', allianceIds).in('role', ['r4', 'r5', 'system_admin']),
      svc.from('members').select('player_name, linked_user_id').in('alliance_id', allianceIds).not('linked_user_id', 'is', null),
    ])

    const playerNameByUser = new Map<string, string>()
    for (const m of members || []) {
      if (m.linked_user_id && m.player_name) playerNameByUser.set(m.linked_user_id, m.player_name)
    }

    const usersByName = new Map<string, Set<string>>()
    const nameByUser = new Map<string, string>()
    for (const p of leaders || []) {
      const name = playerNameByUser.get(p.id) || p.display_name
      if (!name) continue
      nameByUser.set(p.id, name)
      if (!usersByName.has(name)) usersByName.set(name, new Set())
      usersByName.get(name)!.add(p.id)
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
      title: `${senderName} mentioned you in Leadership Chat`,
      message: content.slice(0, 60),
      link: `/kingdoms/${message.kingdom_id}/leadership-chat`,
      related_id: messageId,
    }))
    const { error } = await svc.from('notifications').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, mentions: rows.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
