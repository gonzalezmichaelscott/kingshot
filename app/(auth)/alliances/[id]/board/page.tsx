// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { NewPostForm } from '@/components/board/NewPostForm'
import { BoardClient } from '@/components/board/BoardClient'
import { buildMemberByUser, resolveSenderName } from '@/lib/chat'

export default async function BoardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role, id, display_name, preferred_language').eq('id', user!.id).single()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, user_profiles(display_name), post_replies(id, content, created_at, author_id, user_profiles(display_name))')
    .eq('alliance_id', params.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  // Resolve every author name to their in-game tag (player_name) with the same
  // display_name fallback as chat. The real name from Google/Discord auth must
  // never be shown to other users (Fix 4).
  const { data: members } = await supabase
    .from('members')
    .select('id, player_name, linked_user_id')
    .eq('alliance_id', params.id)
  const memberByUser = buildMemberByUser((members as any[]) || [])
  const nameFor = (authorId: string | null | undefined, prof: any) =>
    resolveSenderName(authorId, prof?.display_name, memberByUser)

  // Sort replies oldest-first within each post for natural thread reading, and
  // attach a privacy-safe authorName to every post + reply.
  const sortedPosts = (posts || []).map(p => ({
    ...p,
    authorName: nameFor(p.author_id, p.user_profiles),
    post_replies: [...((p.post_replies as any[]) || [])]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(r => ({ ...r, authorName: nameFor(r.author_id, r.user_profiles) })),
  }))

  const viewerName = resolveSenderName(profile?.id, profile?.display_name, memberByUser)

  const canPost = ['r5', 'r4', 'system_admin', 'member'].includes(profile?.role || '')
  const canModerate = ['r5', 'r4', 'system_admin'].includes(profile?.role || '')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="text-amber-500" size={24} />
          Message Board — [{alliance.tag}]
        </h1>
      </div>

      {canPost && (
        <NewPostForm allianceId={params.id} authorId={profile?.id} />
      )}

      <BoardClient
        initialPosts={sortedPosts}
        currentUserId={profile?.id || ''}
        currentUserName={viewerName}
        canModerate={canModerate}
        viewerLang={profile?.preferred_language || 'en'}
      />
    </div>
  )
}
