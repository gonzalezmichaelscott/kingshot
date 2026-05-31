// @ts-nocheck
import { redirect } from 'next/navigation'
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

  return (
    <div className="flex min-h-screen">
      <Sidebar allianceId={profile?.alliance_id || undefined} role={profile?.role} />
      <main className="flex-1 lg:ml-64 p-4 lg:p-6 pt-16 lg:pt-6">
        {children}
      </main>
    </div>
  )
}

