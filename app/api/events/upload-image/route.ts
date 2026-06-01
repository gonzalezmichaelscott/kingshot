// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await authClient.from('user_profiles').select('role').eq('id', user.id).single()
    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const eventId = formData.get('eventId') as string | null

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Ensure the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'event-images')
    if (!bucketExists) {
      await supabase.storage.createBucket('event-images', { public: true })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${eventId}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error } = await supabase.storage
      .from('event-images')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data } = supabase.storage.from('event-images').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error: any) {
    console.error('Image upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
