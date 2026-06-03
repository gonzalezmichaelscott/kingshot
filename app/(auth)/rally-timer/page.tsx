// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RallyTimerDashboard } from '@/components/rally-timer/RallyTimerDashboard'

export default async function RallyTimerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('alliance_id, role')
    .eq('id', user.id)
    .single()

  const allianceId = profile?.alliance_id || null
  const canEdit = ['r5', 'r4', 'system_admin'].includes(profile?.role || '')

  // FIX 7 — the rally timer is managed by alliance leadership. Regular members
  // (R1/R2/R3) cannot open the dashboard; they receive a shared link instead.
  if (!canEdit) {
    redirect('/dashboard?notice=rally-timer-leadership')
  }

  // Load existing sessions for this alliance (if any)
  let sessions: any[] = []
  if (allianceId) {
    const { data } = await supabase
      .from('rally_timer_sessions')
      .select('*')
      .eq('alliance_id', allianceId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(5)
    sessions = data || []
  }

  return (
    <RallyTimerDashboard
      allianceId={allianceId}
      userId={user.id}
      canEdit={canEdit}
      initialSessions={sessions}
    />
  )
}
