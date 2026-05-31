// @ts-nocheck
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

interface Props { allianceId: string; authorId?: string }

export function NewPostForm({ allianceId, authorId }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.from('posts').insert({
      alliance_id: allianceId,
      author_id: authorId,
      title: title.trim() || null,
      content: content.trim(),
    })
    setLoading(false)
    setOpen(false)
    setTitle('')
    setContent('')
    router.refresh()
  }

  if (!open) return (
    <Button onClick={() => setOpen(true)} size="sm">
      <span className="mr-1">+</span> New Post
    </Button>
  )

  return (
    <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <Input placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea
        required
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your post..."
        rows={4}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>{loading ? 'Posting...' : 'Post'}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}
