// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBattlePlan } from '@/lib/ai-planner'
import { z } from 'zod'
import { rateLimitResponse, HOUR_MS } from '@/lib/rate-limit'

// `legion` (Swordland only): generate a plan for just that legion, leaving the
// other legion's plan untouched — the legions battle at independent times.
const schema = z.object({
  eventId: z.string().uuid(),
  legion: z.enum(['legion1', 'legion2']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, legion } = schema.parse(body)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Protect against Anthropic cost abuse: 10 generations per hour per user.
    const limited = rateLimitResponse(`battle-plan:${user.id}`, 10, HOUR_MS)
    if (limited) return limited

    const plan = await generateBattlePlan(eventId, legion)
    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Battle plan generation error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
