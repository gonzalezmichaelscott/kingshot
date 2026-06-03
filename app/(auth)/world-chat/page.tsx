// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { WorldChatRoom } from '@/components/chat/WorldChatRoom'

// World Chat — a single global room open to ALL logged-in users across every
// alliance and kingdom. Names are resolved server-side into a directory:
//   name        = member.player_name -> user_profiles.display_name -> "Unknown"
//   allianceTag = the user's alliance tag, or "Guest" with no alliance.
export default async function WorldChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, preferred_language')
    .eq('id', user.id)
    .single()

  // Service client: world chat spans every alliance, so name resolution must read
  // members / profiles / alliances regardless of the viewer's own alliance RLS.
  const svc = createServiceClient()

  const [{ data: messages }, { data: profiles }, { data: members }, { data: alliances }, { data: flags }] =
    await Promise.all([
      svc.from('world_chat_messages').select('*').order('created_at', { ascending: false }).limit(50),
      svc.from('user_profiles').select('id, display_name, alliance_id'),
      svc.from('members').select('player_name, linked_user_id, alliance_id').not('linked_user_id', 'is', null),
      svc.from('alliances').select('id, tag'),
      svc.from('report_flags').select('message_id').eq('message_type', 'world_chat').eq('status', 'pending'),
    ])

  // Auto-hide messages with 3+ pending reports (pending System Admin review).
  const reportCounts = new Map<string, number>()
  for (const f of flags || []) {
    reportCounts.set(f.message_id, (reportCounts.get(f.message_id) || 0) + 1)
  }
  const hiddenIds = new Set<string>()
  reportCounts.forEach((count, mid) => { if (count >= 3) hiddenIds.add(mid) })
  const visibleMessages = (messages || []).filter((m: any) => !hiddenIds.has(m.id))

  const tagById = new Map<string, string>()
  for (const a of alliances || []) tagById.set(a.id, a.tag)

  const playerNameByUser = new Map<string, string>()
  const memberAllianceByUser = new Map<string, string>()
  for (const m of members || []) {
    if (!m.linked_user_id) continue
    if (m.player_name) playerNameByUser.set(m.linked_user_id, m.player_name)
    if (m.alliance_id) memberAllianceByUser.set(m.linked_user_id, m.alliance_id)
  }

  // Build the directory (auth user id -> { name, allianceTag }) and the @ mention list.
  const directory: Record<string, { name: string; allianceTag: string }> = {}
  const mentionMembers: any[] = []
  for (const p of profiles || []) {
    const name = playerNameByUser.get(p.id) || p.display_name || 'Unknown'
    const allianceId = p.alliance_id || memberAllianceByUser.get(p.id)
    const allianceTag = allianceId ? (tagById.get(allianceId) || 'Guest') : 'Guest'
    directory[p.id] = { name, allianceTag }
    if (name !== 'Unknown') {
      mentionMembers.push({ id: p.id, player_name: name, linked_user_id: p.id })
    }
  }
  mentionMembers.sort((a, b) => a.player_name.localeCompare(b.player_name))

  const canDelete = ['r5', 'r4', 'system_admin'].includes(profile?.role || '')

  return (
    // Single-scrollbar layout (Fix 3): fill the viewport below the top bar, cancel
    // the main's bottom padding, and hide outer overflow so only the list scrolls.
    <div className="flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-5rem)] -mb-4 lg:-mb-6 overflow-hidden">
      <WorldChatRoom
        initialMessages={visibleMessages.reverse()}
        currentUserId={user.id}
        currentUserRole={profile?.role || ''}
        currentUserLang={profile?.preferred_language || 'en'}
        directory={directory}
        mentionMembers={mentionMembers}
        canDelete={canDelete}
      />
    </div>
  )
}
