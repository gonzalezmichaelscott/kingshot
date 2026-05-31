// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EventTypeEditor } from '@/components/admin/EventTypeEditor'
import { Calendar } from 'lucide-react'

export default async function AdminEventsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: eventTypes } = await supabase.from('event_types').select('*').order('name')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Calendar className="text-amber-500" size={24} />
        Event Type Management
      </h1>
      <EventTypeEditor eventTypes={eventTypes || []} />
    </div>
  )
}

