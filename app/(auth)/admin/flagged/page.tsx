// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Flag } from 'lucide-react'
import { Breadcrumbs } from '@/components/nav/Breadcrumbs'
import { FlaggedMessagesClient } from '@/components/admin/FlaggedMessagesClient'

export default async function FlaggedMessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/dashboard')

  const svc = createServiceClient()

  // Pending World Chat reports, grouped by message.
  const { data: flags } = await svc
    .from('report_flags')
    .select('id, message_id, reason, reported_by, created_at')
    .eq('message_type', 'world_chat')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const messageIds = [...new Set((flags || []).map((f: any) => f.message_id))]

  // Load the underlying messages + author display names.
  const messageById = new Map<string, any>()
  const nameByUser = new Map<string, string>()
  if (messageIds.length > 0) {
    const { data: msgs } = await svc
      .from('world_chat_messages').select('id, content, author_id, created_at').in('id', messageIds)
    for (const m of msgs || []) messageById.set(m.id, m)

    const authorIds = [...new Set((msgs || []).map((m: any) => m.author_id).filter(Boolean))]
    if (authorIds.length > 0) {
      const { data: mem } = await svc.from('members').select('player_name, linked_user_id').in('linked_user_id', authorIds)
      for (const m of mem || []) if (m.linked_user_id && m.player_name) nameByUser.set(m.linked_user_id, m.player_name)
      const missing = authorIds.filter((id) => !nameByUser.has(id))
      if (missing.length > 0) {
        const { data: profs } = await svc.from('user_profiles').select('id, display_name').in('id', missing)
        for (const p of profs || []) if (p.display_name) nameByUser.set(p.id, p.display_name)
      }
    }
  }

  // Build one entry per flagged message.
  const grouped = messageIds.map((mid) => {
    const msgFlags = (flags || []).filter((f: any) => f.message_id === mid)
    const msg = messageById.get(mid)
    return {
      messageId: mid,
      content: msg?.content ?? '(message deleted)',
      deleted: !msg,
      authorName: msg ? (nameByUser.get(msg.author_id) || 'Unknown') : '—',
      createdAt: msg?.created_at ?? msgFlags[0]?.created_at,
      reportCount: msgFlags.length,
      reasons: msgFlags.map((f: any) => f.reason).filter(Boolean),
    }
  }).sort((a, b) => b.reportCount - a.reportCount)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Flagged Messages' }]} />
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Flag className="text-red-400" size={24} />
        Flagged Messages
      </h1>
      <p className="text-sm text-slate-400">
        Reported World Chat messages. Messages with 3+ reports are auto-hidden from the feed until reviewed.
      </p>
      <FlaggedMessagesClient initialItems={grouped} />
    </div>
  )
}
