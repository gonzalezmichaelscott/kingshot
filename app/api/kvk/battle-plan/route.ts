// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateKingdomKvkBattlePlan } from '@/lib/ai-planner'
import { z } from 'zod'
import { rateLimitResponse, HOUR_MS } from '@/lib/rate-limit'

const schema = z.object({ kingdomId: z.string().uuid() })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { kingdomId } = schema.parse(body)

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

    // Protect against Anthropic cost abuse: 10 generations per hour per user.
    const limited = rateLimitResponse(`kvk-battle-plan:${user.id}`, 10, HOUR_MS)
    if (limited) return limited

    const { plan, eventIds } = await generateKingdomKvkBattlePlan(kingdomId)
    return NextResponse.json({ plan, eventIds })
  } catch (error: any) {
    console.error('Kingdom KVK plan error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
