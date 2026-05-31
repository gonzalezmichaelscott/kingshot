// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewEventForm } from '@/components/events/NewEventForm'

export default async function NewEventPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!['r5', 'r4', 'system_admin'].includes(profile?.role || '')) redirect(`/alliances/${params.id}/events`)

  const { data: eventTypes } = await supabase.from('event_types').select('id, name, slug').eq('is_active', true)

  return (
    <div className="max-w-lg mx-auto mt-4 p-4">
      <h1 className="text-2xl font-bold mb-6">Create Event</h1>
      <NewEventForm allianceId={params.id} eventTypes={eventTypes || []} />
    </div>
  )
}
