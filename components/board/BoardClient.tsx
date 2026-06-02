// @ts-nocheck
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pin, PinOff, Trash2, MessageSquare, ChevronDown, ChevronUp, Loader2, Send } from 'lucide-react'
import { TranslateButton } from '@/components/ui/TranslateButton'

interface Reply {
  id: string
  content: string
  created_at: string
  author_id: string | null
  user_profiles?: { display_name: string | null } | null
}
interface Post {
  id: string
  title: string | null
  content: string
  is_pinned: boolean
  created_at: string
  author_id: string | null
  user_profiles?: { display_name: string | null } | null
  post_replies?: Reply[]
}

interface Props {
  initialPosts: Post[]
  currentUserId: string
  currentUserName: string
  canModerate: boolean
  viewerLang: string
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function BoardClient({ initialPosts, currentUserId, currentUserName, canModerate, viewerLang }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const router = useRouter()
  const supabase = createClient()

  function sortPosts(list: Post[]) {
    return [...list].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  async function togglePin(post: Post) {
    const next = !post.is_pinned
    setPosts(prev => sortPosts(prev.map(p => p.id === post.id ? { ...p, is_pinned: next } : p)))
    await supabase.from('posts').update({ is_pinned: next }).eq('id', post.id)
  }

  async function deletePost(post: Post) {
    if (!confirm('Delete this post and all its replies?')) return
    setPosts(prev => prev.filter(p => p.id !== post.id))
    await fetch('/api/board/delete-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: post.id }),
    })
    router.refresh()
  }

  function addReplyLocal(postId: string, reply: Reply) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, post_replies: [...(p.post_replies || []), reply] } : p))
  }

  if (posts.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-8">No posts yet.</p>
  }

  return (
    <div className="space-y-3">
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canModerate={canModerate}
          viewerLang={viewerLang}
          onTogglePin={togglePin}
          onDelete={deletePost}
          onReplyAdded={addReplyLocal}
        />
      ))}
    </div>
  )
}

function PostCard({ post, currentUserId, currentUserName, canModerate, viewerLang, onTogglePin, onDelete, onReplyAdded }: any) {
  const [expanded, setExpanded] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  const replies: Reply[] = post.post_replies || []
  const canDelete = canModerate || post.author_id === currentUserId

  async function submitReply() {
    const content = replyText.trim()
    if (!content || sending) return
    setSending(true)
    const { data, error } = await supabase
      .from('post_replies')
      .insert({ post_id: post.id, author_id: currentUserId, content })
      .select('id, content, created_at, author_id')
      .single()
    setSending(false)
    if (!error && data) {
      onReplyAdded(post.id, { ...data, user_profiles: { display_name: currentUserName } })
      setReplyText('')
      setReplying(false)
      setExpanded(true)
    }
  }

  return (
    <Card className={post.is_pinned ? 'border-amber-500/50' : ''}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {post.is_pinned && <Pin size={14} className="text-amber-500 flex-shrink-0" />}
              <button onClick={() => setExpanded(e => !e)} className="font-semibold text-left hover:text-amber-400 transition-colors">
                {post.title || 'Post'}
              </button>
            </div>
            <p className={`text-sm text-slate-300 ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{post.content}</p>
            {post.content && (
              <div className="mt-1.5">
                <TranslateButton text={post.content} targetLang={viewerLang} />
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
              <span>{post.user_profiles?.display_name || 'Member'}</span>
              <span>{fmt(post.created_at)}</span>
              <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 hover:text-amber-400 transition-colors">
                <MessageSquare size={12} />
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {/* Moderation actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canModerate && (
              <button
                onClick={() => onTogglePin(post)}
                title={post.is_pinned ? 'Unpin' : 'Pin'}
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
              >
                {post.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(post)}
                title="Delete"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Expanded: replies thread + reply box */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
            {replies.length > 0 ? (
              <div className="space-y-2">
                {replies.map(r => (
                  <div key={r.id} className="bg-slate-800/60 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-0.5">
                      <span className="font-medium text-slate-300">{r.user_profiles?.display_name || 'Member'}</span>
                      <span>{fmt(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{r.content}</p>
                    {r.content && (
                      <div className="mt-1">
                        <TranslateButton text={r.content} targetLang={viewerLang} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No replies yet. Be the first.</p>
            )}

            {!replying ? (
              <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
                <MessageSquare size={14} className="mr-1" /> Reply
              </Button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a reply…"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitReply} disabled={sending || !replyText.trim()}>
                    {sending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
                    Submit Reply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplying(false); setReplyText('') }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
