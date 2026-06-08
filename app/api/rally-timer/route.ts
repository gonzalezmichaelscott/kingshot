// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST — create or update a session
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const service = createServiceClient()

    if (body.id) {
      // Update existing session
      const { data, error } = await service
        .from('rally_timer_sessions')
        .update({
          label: body.label,
          players: body.players,
          status: body.status,
          started_at: body.started_at ?? null,
          scheduled_for: body.scheduled_for ?? null,
          landing_mode: body.landing_mode ?? 'simultaneous',
          landing_gap: body.landing_gap ?? 3,
          custom_order: body.custom_order ?? null,
          round: body.round ?? 1,
        })
        .eq('id', body.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ session: data })
    } else {
      // Create new session
      const { data, error } = await service
        .from('rally_timer_sessions')
        .insert({
          alliance_id: profile.alliance_id,
          label: body.label || 'Rally Timer',
          players: body.players || [],
          status: 'idle',
          created_by: user.id,
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ session: data })
    }
  } catch (error: any) {
    console.error('Rally timer API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — delete a session
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, alliance_id')
      .eq('id', user.id)
      .single()

    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const service = createServiceClient()
    await service.from('rally_timer_sessions').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
