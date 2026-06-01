// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({ postId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    const svc = createServiceClient()
    const { data: post } = await svc
      .from('posts')
      .select('id, author_id, alliance_id')
      .eq('id', postId)
      .single()
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const isLeader = ['r5', 'r4', 'system_admin'].includes(profile?.role || '') && profile?.alliance_id === post.alliance_id
    const isAuthor = post.author_id === user.id
    const isAdmin = profile?.role === 'system_admin'
    if (!isLeader && !isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Replies cascade via ON DELETE CASCADE.
    const { error } = await svc.from('posts').delete().eq('id', postId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Delete post error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
