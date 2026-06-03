// @ts-nocheck
// Public shareable rally timer page — accessible without login.
// FIX 7 — anyone with the link can VIEW (read-only). Only the session creator or
// an R4/R5/system_admin in the session's alliance can edit/control the timer.
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SharedTimerView } from '@/components/rally-timer/SharedTimerView'
import { SharedTimerEditor } from '@/components/rally-timer/SharedTimerEditor'

export default async function SharedRallyTimerPage({ params }: { params: { sessionId: string } }) {
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('rally_timer_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single()

  if (!session) notFound()

  // Determine whether the current viewer may edit this session.
  let canEdit = false
  try {
    const authed = createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (user) {
      if (session.created_by === user.id) {
        canEdit = true
      } else {
        const { data: profile } = await authed
          .from('user_profiles')
          .select('role, alliance_id')
          .eq('id', user.id)
          .maybeSingle()
        if (
          profile &&
          profile.alliance_id === session.alliance_id &&
          ['r4', 'r5', 'system_admin'].includes(profile.role)
        ) {
          canEdit = true
        }
      }
    }
  } catch {
    // Anonymous viewer — read-only.
  }

  if (canEdit) {
    return <SharedTimerEditor session={session} allianceId={session.alliance_id} />
  }

  return <SharedTimerView session={session} />
}
