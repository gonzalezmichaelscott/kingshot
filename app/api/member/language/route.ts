// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { LANGUAGES } from '@/lib/languages'

const schema = z.object({
  access_token: z.string(),
  preferred_language: z.string(),
})

export async function PATCH(request: NextRequest) {
  try {
    const { access_token, preferred_language } = schema.parse(await request.json())

    // Validate against the known language list.
    if (!LANGUAGES.some((l) => l.code === preferred_language)) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
    }

    const svc = createServiceClient()

    // Update the member row and find the linked account (if any).
    const { data: member, error } = await svc
      .from('members')
      .update({ preferred_language, updated_at: new Date().toISOString() })
      .eq('access_token', access_token)
      .select('linked_user_id')
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Keep the linked user_profile in sync so the logged-in experience matches.
    if (member.linked_user_id) {
      await svc
        .from('user_profiles')
        .update({ preferred_language })
        .eq('id', member.linked_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
