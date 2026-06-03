// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateImageFile, safeStorageFilename } from '@/lib/image-validation'

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
    // eventId is part of the storage path — keep it to a safe id shape.
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    // Validate MIME + size + true file header (magic bytes). Rejects spoofed types.
    const check = await validateImageFile(file)
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
    const buffer = Buffer.from(check.buffer)

    const supabase = createServiceClient()

    // Ensure the bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === 'event-images')
    if (!bucketExists) {
      await supabase.storage.createBucket('event-images', { public: true })
    }

    // Server-generated filename (no caller path separators / spoofed extension).
    const path = `${eventId}/${safeStorageFilename(file.type)}`

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
