// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBattlePlan } from '@/lib/ai-planner'
import { z } from 'zod'

const schema = z.object({ eventId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plan = await generateBattlePlan(eventId)
    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Battle plan generation error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
