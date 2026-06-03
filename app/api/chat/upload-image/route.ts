// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateImageFile, safeStorageFilename } from '@/lib/image-validation'
import { rateLimit, MINUTE_MS } from '@/lib/rate-limit'

// Server-side image upload for alliance + world chat. Validates MIME, size, and
// true file header (magic bytes) before storing, and generates a safe filename.
// Any authenticated user may upload (world chat is open to all); the image URL is
// only meaningful once posted as a message, which enforces its own permissions.
export async function POST(request: NextRequest) {
  try {
    const authClient = createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Cap uploads to 30/min/user to curb storage abuse.
    const rl = rateLimit(`chat-upload:${user.id}`, 30, MINUTE_MS)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests — please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const check = await validateImageFile(file)
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
    const buffer = Buffer.from(check.buffer)

    const supabase = createServiceClient()
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some(b => b.name === 'chat-images')) {
      await supabase.storage.createBucket('chat-images', { public: true })
    }

    const path = safeStorageFilename(file.type)
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (error || !data) throw error || new Error('Upload failed')

    const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error: any) {
    console.error('Chat image upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
