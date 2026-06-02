// @ts-nocheck
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isBackendRole } from '@/lib/access'
import { LeaderGuide } from '@/components/guide/LeaderGuide'

export default async function GuidePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Leader Guide is for R4/R5/system_admin.
  if (!isBackendRole(profile?.role)) redirect('/dashboard')

  return <LeaderGuide />
}
