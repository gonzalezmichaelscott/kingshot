// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { NewPostForm } from '@/components/board/NewPostForm'
import { BoardClient } from '@/components/board/BoardClient'

export default async function BoardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role, id, display_name').eq('id', user!.id).single()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, user_profiles(display_name), post_replies(id, content, created_at, author_id, user_profiles(display_name))')
    .eq('alliance_id', params.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  // Sort replies oldest-first within each post for natural thread reading.
  const sortedPosts = (posts || []).map(p => ({
    ...p,
    post_replies: [...((p.post_replies as any[]) || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }))

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
        currentUserName={profile?.display_name || 'You'}
        canModerate={canModerate}
      />
    </div>
  )
}
