// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ban } from 'lucide-react'
import { BlacklistClient } from '@/components/admin/BlacklistClient'

export const dynamic = 'force-dynamic'

export default async function AdminBlacklistPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/dashboard')

  const svc = createServiceClient()
  const { data: rows } = await svc
    .from('blacklisted_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  // Resolve the "blacklisted by" admin display names.
  const enriched = await Promise.all((rows || []).map(async (b: any) => {
    let byName: string | null = null
    if (b.blacklisted_by) {
      const { data: p } = await svc.from('user_profiles').select('display_name').eq('id', b.blacklisted_by).maybeSingle()
      byName = p?.display_name || null
    }
    return { ...b, byName }
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Ban className="text-red-400" size={24} />
        Blacklisted Accounts
      </h1>
      <BlacklistClient rows={enriched} />
    </div>
  )
}
