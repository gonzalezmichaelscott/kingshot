// @ts-nocheck
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/nav/Sidebar'
import { UtcClock } from '@/components/ui/UtcClock'
import { NotificationBell } from '@/components/notifications/NotificationBell'
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

  // Fetch alliance name (chat label) + kingdom id (KVK Command sidebar link)
  let allianceName = 'Alliance'
  let kingdomId: string | undefined
  if (profile?.alliance_id) {
    const { data: allianceData } = await supabase
      .from('alliances')
      .select('name, tag, kingdom_id')
      .eq('id', profile.alliance_id)
      .single()
    if (allianceData) {
      allianceName = `[${allianceData.tag}] ${allianceData.name}`
      kingdomId = allianceData.kingdom_id || undefined
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar allianceId={profile?.alliance_id || undefined} role={profile?.role} userId={user.id} allianceName={allianceName} kingdomId={kingdomId} />
      {/* Top bar: UTC clock always visible — z-50 keeps it above the sidebar overlay (z-40).
           On mobile, pl-12 leaves room for the hamburger button that sits at left-4. */}
      <div className="fixed top-0 right-0 z-50 flex items-center gap-3 pr-4 pl-12 lg:pl-4 h-12 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800/60 lg:left-64 left-0">
        <div className="flex-1" />
        <NotificationBell userId={user.id} role={profile?.role} />
        <UtcClock />
      </div>
      {/* pt-14 must NOT be paired with a lg:p-* shorthand — responsive shorthands
           override all four sides and would reduce padding-top to 24px on desktop,
           hiding content behind the 48px-tall top bar. Split into axis-specific classes. */}
      <main className="flex-1 lg:ml-64 px-4 lg:px-6 pb-4 lg:pb-6 pt-14">
        {children}
      </main>
    </div>
  )
}
