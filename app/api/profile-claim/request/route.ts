// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  member_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json())

    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const svc = createServiceClient()

    // Load the member to verify it exists and is unclaimed
    const { data: member } = await svc
      .from('members')
      .select('id, alliance_id, linked_user_id')
      .eq('id', body.member_id)
      .single()

    if (!member) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (member.linked_user_id) {
      return NextResponse.json({ error: 'This profile is already linked to an account.' }, { status: 409 })
    }

    // Check no pending request already exists for this user + member combo
    const { data: existing } = await svc
      .from('profile_claim_requests')
      .select('id, status')
      .eq('member_id', body.member_id)
      .eq('requesting_user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You already have a pending claim request for this profile.' }, { status: 409 })
    }

    await svc.from('profile_claim_requests').insert({
      member_id: body.member_id,
      requesting_user_id: user.id,
      alliance_id: member.alliance_id,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
