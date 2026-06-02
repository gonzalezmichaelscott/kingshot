// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadApprovalQueues } from '@/lib/approvals'

// Lightweight pending-approval count for the sidebar badge.
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ count: 0 })
    const { data: profile } = await supabase
      .from('user_profiles').select('role, alliance_id').eq('id', user.id).single()
    if (!['r4', 'r5', 'system_admin'].includes(profile?.role || '')) {
      return NextResponse.json({ count: 0 })
    }
    const { count } = await loadApprovalQueues(supabase, profile)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
