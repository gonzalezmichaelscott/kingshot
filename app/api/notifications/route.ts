// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Unified notifications for the bell: chat @mentions + generic `notifications`
// rows (approval_request, etc.).
//
// GET  -> { count, items: [{ kind, id, title, message?, link?, createdAt, allianceId?, messageId? }] }
// POST -> mark read: { all: true } | { id, kind }

async function getMemberIds(svc: any, userId: string): Promise<string[]> {
  const { data } = await svc.from('members').select('id').eq('linked_user_id', userId)
  return (data || []).map((m: any) => m.id)
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()
    const items: any[] = []

    // ---- Chat mentions ----
    const memberIds = await getMemberIds(svc, user.id)
    if (memberIds.length > 0) {
      const { data: mentions } = await svc
        .from('chat_mentions')
        .select('id, message_id, alliance_id, created_at, is_read, chat_messages(content, author_id), alliances(name, tag)')
        .in('mentioned_member_id', memberIds)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50)
      const rows = mentions || []

      const authorIds = [...new Set(rows.map((r: any) => r.chat_messages?.author_id).filter(Boolean))]
      const nameByUser = new Map<string, string>()
      if (authorIds.length > 0) {
        const { data: authorMembers } = await svc
          .from('members').select('player_name, linked_user_id').in('linked_user_id', authorIds)
        for (const m of authorMembers || []) {
          if (m.linked_user_id && m.player_name) nameByUser.set(m.linked_user_id, m.player_name)
        }
        const missing = authorIds.filter((id) => !nameByUser.has(id))
        if (missing.length > 0) {
          const { data: profs } = await svc.from('user_profiles').select('id, display_name').in('id', missing)
          for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name)
        }
      }

      for (const r of rows) {
        const content: string = r.chat_messages?.content || ''
        const alliance = r.alliances
        const allianceName = alliance ? `[${alliance.tag}] ${alliance.name}` : 'Alliance'
        const authorName = nameByUser.get(r.chat_messages?.author_id) || 'Someone'
        items.push({
          kind: 'mention',
          id: r.id,
          title: `${authorName} mentioned you in ${allianceName} chat`,
          message: content.slice(0, 60),
          createdAt: r.created_at,
          allianceId: r.alliance_id,
          messageId: r.message_id,
        })
      }
    }

    // ---- Generic notifications (approval_request, etc.) ----
    const { data: notifs } = await svc
      .from('notifications')
      .select('id, type, title, message, link, created_at')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50)
    for (const n of notifs || []) {
      items.push({
        kind: n.type,
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
        createdAt: n.created_at,
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json({ count: items.length, items })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const svc = createServiceClient()
    const memberIds = await getMemberIds(svc, user.id)

    if (body.all) {
      if (memberIds.length > 0) {
        await svc.from('chat_mentions').update({ is_read: true }).in('mentioned_member_id', memberIds).eq('is_read', false)
      }
      await svc.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      return NextResponse.json({ ok: true })
    }

    if (body.id && body.kind === 'mention') {
      if (memberIds.length > 0) {
        await svc.from('chat_mentions').update({ is_read: true }).eq('id', body.id).in('mentioned_member_id', memberIds)
      }
    } else if (body.id) {
      await svc.from('notifications').update({ is_read: true }).eq('id', body.id).eq('user_id', user.id)
    }
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
