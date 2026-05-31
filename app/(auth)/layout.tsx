// @ts-nocheck
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/nav/Sidebar'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Members (and accounts with no role yet) without an alliance go to /join
  const noAllianceRoles = ['member', null, undefined]
  const currentPath = headers().get('x-pathname') || ''
  const needsAlliance = noAllianceRoles.includes(profile?.role) && !profile?.alliance_id
  const onJoinPage = currentPath.startsWith('/join') || currentPath.startsWith('/alliances/new')

  if (needsAlliance && !onJoinPage) {
    redirect('/join')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar allianceId={profile?.alliance_id || undefined} role={profile?.role} />
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 pt-16 lg:pt-6">
        {children}
      </main>
    </div>
  )
}
