// @ts-nocheck
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/nav/Sidebar'
import { UtcClock } from '@/components/ui/UtcClock'
import { isMemberRole } from '@/lib/access'

// Backend page prefixes that R3-and-below may NOT access
const BACKEND_PREFIXES = ['/alliances', '/admin', '/kingdoms']

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const path = headers().get('x-pathname') || ''
  const onOnboarding = path.startsWith('/onboarding')

  // No alliance yet (and not system_admin) → onboarding
  if (!profile?.alliance_id && profile?.role !== 'system_admin') {
    if (!onOnboarding) redirect('/onboarding')
  } else if (isMemberRole(profile?.role)) {
    // R3, R2, R1 cannot access the Alliance Hub backend
    const onBackend = BACKEND_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
    if (onBackend) redirect('/dashboard')
  }

  // Fetch alliance name for the chat panel label
  let allianceName = 'Alliance'
  if (profile?.alliance_id) {
    const { data: allianceData } = await supabase
      .from('alliances')
      .select('name, tag')
      .eq('id', profile.alliance_id)
      .single()
    if (allianceData) allianceName = `[${allianceData.tag}] ${allianceData.name}`
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar allianceId={profile?.alliance_id || undefined} role={profile?.role} userId={user.id} allianceName={allianceName} />
      {/* Top bar: UTC clock always visible */}
      <div className="fixed top-0 right-0 z-30 flex items-center gap-3 px-4 h-12 bg-slate-950/80 backdrop-blur border-b border-slate-800/50 lg:left-64 left-0">
        <div className="flex-1" />
        <UtcClock />
      </div>
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 pt-16">
        {children}
      </main>
    </div>
  )
}
