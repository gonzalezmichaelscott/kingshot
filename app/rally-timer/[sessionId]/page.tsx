// @ts-nocheck
// Public shareable rally timer page — accessible without login
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SharedTimerView } from '@/components/rally-timer/SharedTimerView'

export default async function SharedRallyTimerPage({ params }: { params: { sessionId: string } }) {
  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('rally_timer_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single()

  if (!session) notFound()

  return <SharedTimerView session={session} />
}
