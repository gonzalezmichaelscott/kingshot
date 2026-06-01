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
