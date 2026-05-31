// @ts-nocheck
﻿// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ScoringEditor } from '@/components/admin/ScoringEditor'
import { BarChart3 } from 'lucide-react'

export default async function AdminScoringPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: eventTypes } = await supabase.from('event_types').select('id, name, slug, scoring_weights').eq('is_active', true)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="text-amber-500" size={24} />
        Scoring Formula Editor
      </h1>
      <ScoringEditor eventTypes={eventTypes || []} />
    </div>
  )
}

