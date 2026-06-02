// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET  /api/chat/notifications        -> unread mentions for the current user
// POST /api/chat/notifications        -> mark read ({ id } for one, { all: true } for all)

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
    const memberIds = await getMemberIds(svc, user.id)
    if (memberIds.length === 0) return NextResponse.json({ count: 0, items: [] })

    const { data: mentions } = await svc
      .from('chat_mentions')
      .select('id, message_id, alliance_id, created_at, is_read, chat_messages(content, author_id), alliances(name, tag)')
      .in('mentioned_member_id', memberIds)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50)

    const rows = mentions || []

    // Resolve author game tags (player_name) with display_name fallback.
    const authorIds = [...new Set(rows.map((r: any) => r.chat_messages?.author_id).filter(Boolean))]
    const nameByUser = new Map<string, string>()
    if (authorIds.length > 0) {
      const { data: authorMembers } = await svc
        .from('members')
        .select('player_name, linked_user_id')
        .in('linked_user_id', authorIds)
      for (const m of authorMembers || []) {
        if (m.linked_user_id && m.player_name) nameByUser.set(m.linked_user_id, m.player_name)
      }
      const missing = authorIds.filter((id) => !nameByUser.has(id))
      if (missing.length > 0) {
        const { data: profs } = await svc
          .from('user_profiles')
          .select('id, display_name')
          .in('id', missing)
        for (const p of profs || []) {
          if (p.display_name) nameByUser.set(p.id, p.display_name)
        }
      }
    }

    const items = rows.map((r: any) => {
      const content: string = r.chat_messages?.content || ''
      const alliance = r.alliances
      const allianceName = alliance ? `[${alliance.tag}] ${alliance.name}` : 'Alliance'
      const authorName = nameByUser.get(r.chat_messages?.author_id) || 'Someone'
      return {
        id: r.id,
        messageId: r.message_id,
        allianceId: r.alliance_id,
        allianceName,
        authorName,
        preview: content.slice(0, 60),
        createdAt: r.created_at,
      }
    })

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
    if (memberIds.length === 0) return NextResponse.json({ ok: true })

    let q = svc.from('chat_mentions').update({ is_read: true }).in('mentioned_member_id', memberIds).eq('is_read', false)
    if (!body.all && body.id) q = q.eq('id', body.id)

    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error' }, { status: 500 })
  }
}
