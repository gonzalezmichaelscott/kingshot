// @ts-nocheck
import { redirect, notFound } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { LeadershipChatRoom } from '@/components/chat/LeadershipChatRoom'

// FIX 4 — Leadership Chat: kingdom-level room restricted to R4/R5/system_admin
// across every alliance in the kingdom. Names resolve to "[TAG] GameName".
export default async function LeadershipChatPage({ params }: { params: { id: string } }) {
  const kingdomId = params.id
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, alliance_id, preferred_language')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'system_admin'
  const isLeader = ['r4', 'r5'].includes(profile?.role || '')

  // The viewer's own kingdom (from their alliance) — leaders may only access the
  // Leadership Chat of the kingdom they belong to. System Admin may access any.
  let viewerKingdomId: string | null = null
  if (profile?.alliance_id) {
    const { data: viewerAlliance } = await supabase
      .from('alliances')
      .select('kingdom_id')
      .eq('id', profile.alliance_id)
      .maybeSingle()
    viewerKingdomId = viewerAlliance?.kingdom_id || null
  }

  const allowed = isAdmin || (isLeader && viewerKingdomId === kingdomId)
  if (!allowed) {
    redirect('/dashboard?notice=leadership-chat-restricted')
  }

  // Service client: the chat spans every alliance in the kingdom, so name
  // resolution must read members / profiles / alliances regardless of RLS.
  const svc = createServiceClient()

  const { data: kingdom } = await svc.from('kingdoms').select('id').eq('id', kingdomId).maybeSingle()
  if (!kingdom) notFound()

  const [{ data: messages }, { data: alliances }] = await Promise.all([
    svc.from('leadership_chat_messages').select('*').eq('kingdom_id', kingdomId).order('created_at', { ascending: false }).limit(50),
    svc.from('alliances').select('id, tag').eq('kingdom_id', kingdomId),
  ])

  const allianceIds = (alliances || []).map((a: any) => a.id)
  const tagById = new Map<string, string>()
  for (const a of alliances || []) tagById.set(a.id, a.tag)

  // Leadership profiles in this kingdom (the chat's participants + mention targets).
  const { data: leaders } = allianceIds.length
    ? await svc
        .from('user_profiles')
        .select('id, display_name, alliance_id, role')
        .in('alliance_id', allianceIds)
        .in('role', ['r4', 'r5', 'system_admin'])
    : { data: [] }

  // Linked roster names for the leaders, so we can show the game tag over display_name.
  const { data: members } = allianceIds.length
    ? await svc
        .from('members')
        .select('player_name, linked_user_id, alliance_id')
        .in('alliance_id', allianceIds)
        .not('linked_user_id', 'is', null)
    : { data: [] }

  const playerNameByUser = new Map<string, string>()
  for (const m of members || []) {
    if (m.linked_user_id && m.player_name) playerNameByUser.set(m.linked_user_id, m.player_name)
  }

  // Directory (author id -> { name, allianceTag }) + the R4/R5 mention list.
  const directory: Record<string, { name: string; allianceTag: string; role?: string }> = {}
  const mentionMembers: any[] = []
  for (const p of leaders || []) {
    const name = playerNameByUser.get(p.id) || p.display_name || 'Unknown'
    const allianceTag = p.alliance_id ? (tagById.get(p.alliance_id) || 'Guest') : 'Guest'
    directory[p.id] = { name, allianceTag, role: p.role }
    if (name !== 'Unknown') {
      mentionMembers.push({ id: p.id, player_name: name, linked_user_id: p.id })
    }
  }
  mentionMembers.sort((a, b) => a.player_name.localeCompare(b.player_name))

  // Ensure the viewer can always resolve their own identity even if not in `leaders`
  // (e.g. a System Admin with no alliance in this kingdom).
  if (!directory[user.id]) {
    const tag = profile?.alliance_id ? (tagById.get(profile.alliance_id) || 'Admin') : 'Admin'
    directory[user.id] = { name: playerNameByUser.get(user.id) || 'Admin', allianceTag: tag, role: profile?.role }
  }

  // Only System Admin can delete ANY message; authors delete their own (isOwn).
  const canDelete = isAdmin

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] lg:h-[calc(100vh-5rem)] -mb-4 lg:-mb-6 overflow-hidden">
      <LeadershipChatRoom
        kingdomId={kingdomId}
        initialMessages={(messages || []).reverse()}
        currentUserId={user.id}
        currentUserLang={profile?.preferred_language || 'en'}
        directory={directory}
        mentionMembers={mentionMembers}
        canDelete={canDelete}
      />
    </div>
  )
}
