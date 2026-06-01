// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: { memberId: string } }) {
  try {
    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: actor } = await authed
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!actor || !['r5', 'system_admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Forbidden — R5 or System Admin only' }, { status: 403 })
    }

    const svc = createServiceClient()

    const { data: member } = await svc
      .from('members')
      .select('id, alliance_id, linked_user_id')
      .eq('id', params.memberId)
      .single()

    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    if (actor.role !== 'system_admin' && member.alliance_id !== actor.alliance_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Unlink: clear linked_user_id on the member
    await svc.from('members').update({
      linked_user_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', member.id)

    // Also clear alliance from the user's profile so they go back to onboarding
    if (member.linked_user_id) {
      await svc.from('user_profiles').update({
        alliance_id: null,
      }).eq('id', member.linked_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bad request' }, { status: 400 })
  }
}
