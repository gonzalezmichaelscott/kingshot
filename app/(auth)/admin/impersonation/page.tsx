// @ts-nocheck
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { ImpersonationClient } from '@/components/admin/ImpersonationClient'

export const dynamic = 'force-dynamic'

export default async function AdminImpersonationPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/dashboard')

  const svc = createServiceClient()
  const { data: reports } = await svc
    .from('impersonation_reports')
    .select('*')
    .order('created_at', { ascending: false })

  // Enrich each report with the suspected member + its current account holder email.
  const enriched = await Promise.all((reports || []).map(async (r: any) => {
    let member: any = null
    let holderEmail: string | null = null
    if (r.suspected_member_id) {
      const { data: m } = await svc
        .from('members')
        .select('id, player_name, game_id, alliance_id, linked_user_id, alliances!members_alliance_id_fkey(name, tag)')
        .eq('id', r.suspected_member_id)
        .maybeSingle()
      member = m || null
      if (m?.linked_user_id) {
        try {
          const { data: holder } = await svc.auth.admin.getUserById(m.linked_user_id)
          holderEmail = holder?.user?.email || null
        } catch { /* ignore */ }
      }
    }
    return { ...r, member, holderEmail }
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="text-amber-500" size={24} />
        Impersonation Reports
      </h1>
      <ImpersonationClient reports={enriched} />
    </div>
  )
}
