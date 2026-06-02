// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateKingdomKvkBattlePlan } from '@/lib/ai-planner'
import { z } from 'zod'

const schema = z.object({ kingdomId: z.string().uuid(), planMode: z.enum(['A', 'B']).optional().default('A') })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kingdomId, planMode } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only R5 and system_admin may generate the kingdom-wide plan.
    if (!['r5', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { plan, eventIds } = await generateKingdomKvkBattlePlan(kingdomId, planMode)
    return NextResponse.json({ plan, eventIds })
  } catch (error: any) {
    console.error('Kingdom KVK plan error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
