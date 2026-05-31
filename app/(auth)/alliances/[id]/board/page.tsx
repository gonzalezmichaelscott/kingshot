// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Pin, Plus } from 'lucide-react'
import Link from 'next/link'
import { NewPostForm } from '@/components/board/NewPostForm'

export default async function BoardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: alliance } = await supabase.from('alliances').select('name, tag').eq('id', params.id).single()
  if (!alliance) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role, id').eq('id', user!.id).single()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, user_profiles(display_name), post_replies(id)')
    .eq('alliance_id', params.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  const canPost = ['r5', 'r4', 'system_admin', 'member'].includes(profile?.role || '')

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

      <div className="space-y-3">
        {posts?.map(post => (
          <Card key={post.id} className={post.is_pinned ? 'border-amber-500/50' : ''}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {post.is_pinned && <Pin size={14} className="text-amber-500 flex-shrink-0" />}
                    <h3 className="font-semibold">{post.title || 'Post'}</h3>
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{(post.user_profiles as any)?.display_name}</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    <span>{(post.post_replies as any[])?.length || 0} replies</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!posts || posts.length === 0) && (
          <p className="text-slate-400 text-sm text-center py-8">No posts yet.</p>
        )}
      </div>
    </div>
  )
}
